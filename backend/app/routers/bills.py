import base64
import io
import logging
import os
import time
from pathlib import Path

import pdfplumber
from flask import Blueprint, jsonify, request
from supabase import create_client, Client

from app.legiscan import LegiScan

logger = logging.getLogger(__name__)

DEV = os.getenv("DEV", "false").lower() == "true"
DEV_BILL_LIMIT = 10

LOG_FILE = Path(__file__).parent.parent / "collect.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

bills_bp = Blueprint("bills", __name__, url_prefix="/bills")

# PDF_STATES = [
#     "AK", "AL", "AR", "CO", "CT", "DC", "FL", "GA", "HI", "ID",
#     "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MN", "MO", "MS",
#     "MT", "NC", "ND", "NE", "NJ", "NM", "NV", "OH", "OK", "OR",
#     "PA", "RI", "SD", "TN", "US", "UT", "VA", "VT", "WA", "WI", "WY",
# ]
PDF_STATES = [
 "MA", "CT", "MD", "RI"
]

PDF_MIME = "application/pdf"
_PDF_LINK_FIELDS = ("url", "state_link", "alt_state_link")
MAX_PAGE_SIZE = 100


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int, minimum: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        parsed = default
    return max(parsed, minimum)


def _get_supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def _get_current_session_id(legis: LegiScan, state: str) -> int | None:
    sessions = legis.get_session_list(state)
    active = [s for s in sessions if not s.get("prior") and not s.get("sine_die")]
    pool = active if active else sessions
    if not pool:
        return None
    pool.sort(key=lambda s: s.get("year_start", 0), reverse=True)
    return pool[0]["session_id"]


_PARTY_MAP = {
    "D": "Democratic",
    "R": "Republican",
    "I": "Independent",
}


def _get_sponsor_party(sponsors: list[dict]) -> str | None:
    primary = next((s for s in sponsors if s.get("sponsor_type_id") == 1), None)
    sponsor = primary or (sponsors[0] if sponsors else None)
    if not sponsor:
        return None
    return _PARTY_MAP.get(sponsor.get("party"), "Independent")


def _url_looks_pdf(url: str) -> bool:
    path = (url or "").split("?")[0]
    return path.lower().endswith(".pdf")


def _best_pdf_link(text_entry: dict) -> str | None:
    for field in _PDF_LINK_FIELDS:
        v = (text_entry.get(field) or "").strip()
        if v and _url_looks_pdf(v):
            return v
    for field in _PDF_LINK_FIELDS:
        v = (text_entry.get(field) or "").strip()
        if v:
            return v
    return None


def _extract_pdf_text_and_url(legis: LegiScan, texts: list[dict]) -> tuple[str | None, str | None]:
    """Extract plain text from the first readable PDF bill text; capture its document URL."""
    fallback_url: str | None = None
    for t in texts:
        if t.get("mime") != PDF_MIME:
            continue
        doc_url = _best_pdf_link(t)
        if doc_url and fallback_url is None:
            fallback_url = doc_url
        try:
            doc = legis.get_bill_text(t["doc_id"])
            pdf_bytes = base64.b64decode(doc["doc"])
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            extracted = text.strip() or None
            return extracted, doc_url or fallback_url
        except Exception:
            continue
    return None, fallback_url


@bills_bp.route("/collect", methods=["POST"])
def collect():
    """Collect bills from all PDF states, extract PDF text, and upsert into Supabase."""
    sample_size = request.json.get("sample_size", 20) if request.is_json else 20
    legis = LegiScan()
    sb = _get_supabase()

    total_bills = 0
    states_done = []
    states_failed = []

    if DEV:
        log.info(f"DEV mode: limiting to {DEV_BILL_LIMIT} bills total")

    for state in PDF_STATES:
        if DEV and total_bills >= DEV_BILL_LIMIT:
            break
        try:
            log.info(f"[{state}] fetching current session...")
            session_id = _get_current_session_id(legis, state)
            if not session_id:
                log.warning(f"[{state}] no session found, skipping")
                states_failed.append(state)
                continue

            master = legis.get_master_list(session_id=session_id)
            limit = min(sample_size, DEV_BILL_LIMIT - total_bills) if DEV else sample_size
            log.info(f"[{state}] session {session_id}, collecting {limit} bills...")

            state_bills = []
            for entry in master[:limit]:
                bill_id = entry.get("bill_id")
                log.info(f"[{state}] bill {bill_id} ({entry.get('number')}) — fetching detail + PDF text")
                try:
                    detail = legis.get_bill(bill_id=bill_id)
                    texts = detail.get("texts", [])
                    pdf_text, pdf_url = _extract_pdf_text_and_url(legis, texts)
                    party = _get_sponsor_party(detail.get("sponsors", []))
                    if pdf_text:
                        log.info(f"[{state}] bill {bill_id} — extracted {len(pdf_text)} chars")
                    else:
                        log.warning(f"[{state}] bill {bill_id} — no PDF text extracted")
                    if pdf_url:
                        log.info(f"[{state}] bill {bill_id} — pdf_url present")
                    log.info(f"[{state}] bill {bill_id} — party: {party}")
                except Exception as e:
                    log.error(f"[{state}] bill {bill_id} — error: {e}")
                    pdf_text = None
                    pdf_url = None
                    party = None

                state_bills.append({
                    "bill_id": bill_id,
                    "bill_number": entry.get("number"),
                    "title": entry.get("title"),
                    "description": entry.get("description", ""),
                    "state": state,
                    "url": entry.get("url", ""),
                    "pdf_url": pdf_url,
                    "last_action": entry.get("last_action", ""),
                    "last_action_date": entry.get("last_action_date", ""),
                    "text": pdf_text,
                    "party": party,
                })
                time.sleep(0.1)

            state_bills = [b for b in state_bills if b["bill_id"] is not None]
            if state_bills:
                log.info(f"[{state}] upserting {len(state_bills)} bills into Supabase...")
                sb.table("bills").upsert(state_bills, on_conflict="bill_id").execute()

            total_bills += len(state_bills)
            states_done.append(state)
            log.info(f"[{state}] done. total bills so far: {total_bills}")
        except Exception as e:
            log.error(f"[{state}] failed: {e}")
            states_failed.append(state)

    return jsonify({
        "total_bills": total_bills,
        "states_done": states_done,
        "states_failed": states_failed,
    })


@bills_bp.route("/")
def list_bills():
    sb = _get_supabase()
    state = request.args.get("state", "").upper() or None
    include_text = _as_bool(request.args.get("include_text"), default=False)
    limit = min(_as_int(request.args.get("limit"), default=30, minimum=1), MAX_PAGE_SIZE)
    offset = _as_int(request.args.get("offset"), default=0, minimum=0)

    logger.info("list_bills called: state=%s, limit=%d, offset=%d, include_text=%s",
                state, limit, offset, include_text)

    select_columns = (
        "*"
        if include_text
        else (
            "bill_id,bill_number,title,description,state,url,pdf_url,last_action,"
            "last_action_date,created_at,bill_elo,party"
        )
    )
    query = sb.table("bills").select(select_columns)
    if state:
        query = query.eq("state", state)
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

    try:
        result = query.execute()
    except Exception as exc:
        logger.exception("Supabase query failed in list_bills")
        return jsonify({"error": "failed to query bills", "details": str(exc)}), 500

    logger.info("list_bills returned %d rows", len(result.data) if result.data else 0)
    return jsonify(result.data)


@bills_bp.route("/<int:bill_id>")
def get_bill(bill_id):
    bill = LegiScan().get_bill(bill_id=bill_id)
    return jsonify(bill)
