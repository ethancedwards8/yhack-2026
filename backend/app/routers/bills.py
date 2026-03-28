import json
import time
from pathlib import Path
from flask import Blueprint, jsonify, request
from app.legiscan import LegiScan

bills_bp = Blueprint("bills", __name__, url_prefix="/bills")

PDF_STATES = [
    "AK", "AL", "AR", "CO", "CT", "DC", "FL", "GA", "HI", "ID",
    "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MN", "MO", "MS",
    "MT", "NC", "ND", "NE", "NJ", "NM", "NV", "OH", "OK", "OR",
    "PA", "RI", "SD", "TN", "US", "UT", "VA", "VT", "WA", "WI", "WY",
]

BILLS_FILE = Path(__file__).parent.parent / "bills.json"


def _load_bills() -> list[dict]:
    if BILLS_FILE.exists():
        return json.loads(BILLS_FILE.read_text())
    return []


def _save_bills(bills: list[dict]):
    BILLS_FILE.write_text(json.dumps(bills))


def _get_current_session_id(legis: LegiScan, state: str) -> int | None:
    sessions = legis.get_session_list(state)
    active = [s for s in sessions if not s.get("prior") and not s.get("sine_die")]
    pool = active if active else sessions
    if not pool:
        return None
    pool.sort(key=lambda s: s.get("year_start", 0), reverse=True)
    return pool[0]["session_id"]


@bills_bp.route("/collect", methods=["POST"])
def collect():
    """Collect bills from all PDF states and save to disk."""
    sample_size = request.json.get("sample_size", 20) if request.is_json else 20
    legis = LegiScan()

    bills = []
    states_done = []
    states_failed = []

    for state in PDF_STATES:
        try:
            session_id = _get_current_session_id(legis, state)
            if not session_id:
                states_failed.append(state)
                continue

            master = legis.get_master_list(session_id=session_id)
            for entry in master[:sample_size]:
                bills.append({
                    "bill_id": entry.get("bill_id"),
                    "bill_number": entry.get("number"),
                    "title": entry.get("title"),
                    "description": entry.get("description", ""),
                    "state": state,
                    "url": entry.get("url", ""),
                    "last_action": entry.get("last_action", ""),
                    "last_action_date": entry.get("last_action_date", ""),
                })
                time.sleep(0.05)

            states_done.append(state)
        except Exception:
            states_failed.append(state)

    _save_bills(bills)

    return jsonify({
        "total_bills": len(bills),
        "states_done": states_done,
        "states_failed": states_failed,
    })


@bills_bp.route("/")
def list_bills():
    state = request.args.get("state", "").upper() or None
    bills = _load_bills()
    if state:
        bills = [b for b in bills if b["state"] == state]
    return jsonify(bills)


@bills_bp.route("/<int:bill_id>")
def get_bill(bill_id):
    """Get full detail for a single bill from LegiScan."""
    bill = LegiScan().get_bill(bill_id=bill_id)
    return jsonify(bill)
