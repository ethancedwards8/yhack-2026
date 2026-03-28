import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from app.legiscan import LegiScan
from app.routers.bills import bills_bp

_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env")

app = Flask(__name__)
app.register_blueprint(bills_bp)

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


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/search")
def search():
    query = request.args.get("q", "")
    state = request.args.get("state", "ALL")
    results = legis.search(state=state, query=query)
    return jsonify(results)


@app.route("/bill/<int:bill_id>")
def get_bill(bill_id):
    bill = legis.get_bill(bill_id)
    return jsonify(bill)
