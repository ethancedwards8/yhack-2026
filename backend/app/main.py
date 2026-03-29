import logging
import os
import sys
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from supabase import Client, create_client

from app.auth import require_auth
from app.legiscan import LegiScan
from app.routers.bills import bills_bp
from app.routers.users import users_bp
from app.routers.votes import votes_bp
from app.algorithm import elo_alg

load_dotenv(dotenv_path=_backend_root / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
app.register_blueprint(bills_bp)
app.register_blueprint(users_bp)
app.register_blueprint(votes_bp)

legis = LegiScan()


@lru_cache(maxsize=1)
def _get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _normalize_bill_bias(raw_bias) -> int:
    if isinstance(raw_bias, int) and raw_bias in (0, 1, 2):
        return raw_bias
    if isinstance(raw_bias, float) and raw_bias in (0.0, 1.0, 2.0):
        return int(raw_bias)

    text = str(raw_bias).strip()
    mapping = {
        "Republican": 1,
        "Democrat": 0,
        "Democratic": 0,
        "Independent": 2,
    }
    return mapping.get(text, 2)

_default_origins = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]
_origins_env = os.environ.get("CORS_ORIGINS")
_origins = (
    [o.strip() for o in _origins_env.split(",") if o.strip()]
    if _origins_env
    else _default_origins
)
CORS(
    app,
    resources={r"/*": {"origins": _origins}},
    supports_credentials=True,
)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/me")
@require_auth
def me():
    logger.info("GET /me for user_id=%s", g.user_id)
    sb = _get_supabase()
    try:
        result = sb.table("users").select("*").eq("user_id", g.user_id).single().execute()
    except Exception as exc:
        logger.exception("GET /me supabase query failed for user_id=%s", g.user_id)
        return jsonify({"error": "failed to fetch user", "details": str(exc)}), 500
    logger.info("GET /me result: %s", result.data)
    return jsonify(result.data)


@app.route("/me", methods=["PATCH"])
@require_auth
def update_me():
    data = request.get_json(silent=True) or {}
    allowed = {k: v for k, v in data.items() if k in ("state", "bias")}
    if not allowed:
        return jsonify({"error": "no valid fields to update"}), 400
    sb = _get_supabase()
    result = sb.table("users").update(allowed).eq("user_id", g.user_id).execute()
    return jsonify(result.data[0] if result.data else {})


@app.route("/search")
def search():
    query = request.args.get("q", "")
    state = request.args.get("state", "ALL")
    results = legis.search(state=state, query=query)
    return jsonify(results)

@app.route("/elo", methods=["POST"])
def update_elo():
    sb = _get_supabase()
    data = request.get_json(silent=True) or {}

    bill_id_raw = data.get("bill_id")
    user_id_raw = data.get("user_id")
    user_vote_raw = data.get("user_vote")

    if bill_id_raw is None or user_id_raw is None or user_vote_raw is None:
        return jsonify({"error": "bill_id, user_id, and user_vote are required"}), 400

    try:
        bill_id = int(bill_id_raw)
        user_id = int(user_id_raw)
        user_vote = int(user_vote_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "bill_id, user_id, and user_vote must be integers"}), 400

    bill = (
        sb.table("bills")
        .select("party")
        .eq("bill_id", bill_id)
        .single()
        .execute()
        .data
    )
    if not bill:
        return jsonify({"error": "bill not found", "bill_id": bill_id}), 404

    user = (
        sb.table("users")
        .select("bias")
        .eq("user_id", str(user_id))
        .single()
        .execute()
        .data
    )
    if not user:
        return jsonify({"error": "user not found", "user_id": user_id}), 404

    bill_bias = _normalize_bill_bias(bill.get("party"))
    user_bias_raw = user.get("bias")
    try:
        user_bias = float(user_bias_raw) if user_bias_raw is not None else 0.5
    except (TypeError, ValueError):
        return jsonify({"error": "invalid user bias"}), 400

    try:
        delta_float = elo_alg(
            elo=0.0,
            bill_bias=bill_bias,
            user_bias=user_bias,
            user_vote=user_vote,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    delta = int(round(delta_float))

    rpc_result = (
        sb.rpc(
            "update_bill_elo",
            {
                "p_bill_id": bill_id,
                "p_delta": delta,
            },
        )
        .execute()
    )

    new_elo = rpc_result.data
    if isinstance(new_elo, list):
        new_elo = new_elo[0] if new_elo else None

    return jsonify({"bill_id": bill_id, "delta": delta, "new_elo": new_elo})

@app.route("/user/<user_id>")
def get_user(user_id):
    try:
        sb = _get_supabase()
        result = (
            sb.table("users")
            .select("user_id,bias,name,email")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        return jsonify({"error": "failed to query users", "details": str(exc)}), 500

    if not result.data:
        return jsonify({"error": "user not found", "user_id": user_id}), 404

    row = result.data[0]
    bias = row.get("bias")
    user_bias = float(bias) if bias is not None else 0.5

    return jsonify(
        {
            "user_id": row.get("user_id", user_id),
            "name": row.get("name"),
            "email": row.get("email"),
            "bias": user_bias,
        }
    )


@app.route("/bill/<int:bill_id>")
def get_bill(bill_id):
    try:
        sb = _get_supabase()
        result = sb.table("bills").select("*").eq("bill_id", bill_id).limit(1).execute()
    except Exception as exc:
        return jsonify({"error": "failed to query bills", "details": str(exc)}), 500

    if not result.data:
        return jsonify({"error": "bill not found", "bill_id": bill_id}), 404

    row = result.data[0]
    elo_raw = row.get("bill_elo", row.get("elo", 1000))
    try:
        elo_value = float(elo_raw)
    except (TypeError, ValueError):
        elo_value = 1000.0

    bias_source = row.get("party")
    bill_bias = _normalize_bill_bias(bias_source)

    return jsonify(
        {
            "bill_id": row.get("bill_id", bill_id),
            "elo": elo_value,
            "bias": bill_bias,
            "party": row.get("party"),
            "title": row.get("title"),
            "state": row.get("state"),
        }
    )


@app.route("/legiscan/bill/<int:bill_id>")
def get_legiscan_bill(bill_id):
    bill = legis.get_bill(bill_id)
    return jsonify(bill)


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG", "false").strip().lower() == "true",
    )
