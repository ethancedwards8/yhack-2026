import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from supabase import create_client

from app.auth import require_auth
from app.legiscan import LegiScan
from app.routers.bills import bills_bp
from app.routers.users import users_bp
from app.routers.votes import votes_bp

_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env")

app = Flask(__name__)
app.register_blueprint(bills_bp)
app.register_blueprint(users_bp)
app.register_blueprint(votes_bp)

legis = LegiScan()

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


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/me")
@require_auth
def me():
    sb = _get_supabase()
    result = sb.table("users").select("*").eq("user_id", g.user_id).single().execute()
    return jsonify(result.data)


@app.route("/search")
def search():
    query = request.args.get("q", "")
    state = request.args.get("state", "ALL")
    results = legis.search(state=state, query=query)
    return jsonify(results)


@app.route("/bill/<int:bill_id>")
def get_bill(bill_id):
    sb = _get_supabase()
    result = sb.table("bills").select("*").eq("bill_id", bill_id).single().execute()
    return jsonify(result.data)
