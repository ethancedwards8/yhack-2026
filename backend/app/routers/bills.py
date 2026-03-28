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

PDF_STATES = [
    "AK", "AL", "AR", "CO", "CT", "DC", "FL", "GA", "HI", "ID",
    "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MN", "MO", "MS",
    "MT", "NC", "ND", "NE", "NJ", "NM", "NV", "OH", "OK", "OR",
    "PA", "RI", "SD", "TN", "US", "UT", "VA", "VT", "WA", "WI", "WY",
]

PDF_MIME = "application/pdf"


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


def _extract_pdf_text(legis: LegiScan, texts: list[dict]) -> str | None:
    for t in texts:
        if t.get("mime") != PDF_MIME:
            continue
        try:
            doc = legis.get_bill_text(t["doc_id"])
            pdf_bytes = base64.b64decode(doc["doc"])
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            return text.strip() or None
        except Exception:
            continue
    return None


@bills_bp.route("/collect", methods=["POST"])
def collect():
    """Collect bills from all PDF states, extract PDF text, and upsert into Supabase."""
    sample_size = request.json.get("sample_size", 20) if request.is_json else 20
    legis = LegiScan()
    sb = _get_supabase()

    bills = []
    states_done = []
    states_failed = []

    if DEV:
        log.info(f"DEV mode: limiting to {DEV_BILL_LIMIT} bills total")

    for state in PDF_STATES:
        if DEV and len(bills) >= DEV_BILL_LIMIT:
            break
        try:
            log.info(f"[{state}] fetching current session...")
            session_id = _get_current_session_id(legis, state)
            if not session_id:
                log.warning(f"[{state}] no session found, skipping")
                states_failed.append(state)
                continue

            master = legis.get_master_list(session_id=session_id)
            limit = min(sample_size, DEV_BILL_LIMIT - len(bills)) if DEV else sample_size
            log.info(f"[{state}] session {session_id}, collecting {limit} bills...")

            for entry in master[:limit]:
                bill_id = entry.get("bill_id")
                log.info(f"[{state}] bill {bill_id} ({entry.get('number')}) — fetching detail + PDF text")
                try:
                    detail = legis.get_bill(bill_id=bill_id)
                    texts = detail.get("texts", [])
                    pdf_text = _extract_pdf_text(legis, texts)
                    if pdf_text:
                        log.info(f"[{state}] bill {bill_id} — extracted {len(pdf_text)} chars")
                    else:
                        log.warning(f"[{state}] bill {bill_id} — no PDF text extracted")
                except Exception as e:
                    log.error(f"[{state}] bill {bill_id} — error: {e}")
                    pdf_text = None

                bills.append({
                    "bill_id": bill_id,
                    "bill_number": entry.get("number"),
                    "title": entry.get("title"),
                    "description": entry.get("description", ""),
                    "state": state,
                    "url": entry.get("url", ""),
                    "last_action": entry.get("last_action", ""),
                    "last_action_date": entry.get("last_action_date", ""),
                    "text": pdf_text,
                })
                time.sleep(0.1)

            states_done.append(state)
            log.info(f"[{state}] done. total bills so far: {len(bills)}")
        except Exception as e:
            log.error(f"[{state}] failed: {e}")
            states_failed.append(state)

    if bills:
        log.info(f"Upserting {len(bills)} bills into Supabase...")
        sb.table("bills").upsert(bills, on_conflict="bill_id").execute()
        log.info("Upsert complete.")

    return jsonify({
        "total_bills": len(bills),
        "states_done": states_done,
        "states_failed": states_failed,
    })


@bills_bp.route("/")
def list_bills():
    sb = _get_supabase()
    state = request.args.get("state", "").upper() or None
    query = sb.table("bills").select("*")
    if state:
        query = query.eq("state", state)
    result = query.execute()
    return jsonify(result.data)


@bills_bp.route("/<int:bill_id>")
def get_bill(bill_id):
    bill = LegiScan().get_bill(bill_id=bill_id)
    return jsonify(bill)
