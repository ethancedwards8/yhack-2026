import os
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.legiscan import LegiScan

_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env")


def _make_pool() -> ConnectionPool | None:
    url = os.environ.get("DATABASE_URL")
    if not url or not url.strip():
        return None
    return ConnectionPool(
        conninfo=url.strip(),
        min_size=1,
        max_size=10,
    )


pool = _make_pool()

app = Flask(__name__)
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
    resources={r"/api/*": {"origins": _origins}},
    supports_credentials=True,
)


def _json_row(row: dict) -> dict:
    out = dict(row)
    cid = out.get("id")
    if isinstance(cid, UUID):
        out["id"] = str(cid)
    ts = out.get("created_at")
    if ts is not None and hasattr(ts, "isoformat"):
        out["created_at"] = ts.isoformat()
    return out


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/demo-items", methods=["GET"])
def list_demo_items():
    if pool is None:
        return jsonify({"error": "DATABASE_URL is not configured"}), 503
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT id, body, created_at FROM demo_items ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
    return jsonify([_json_row(r) for r in rows])


@app.route("/api/demo-items", methods=["POST"])
def create_demo_item():
    if pool is None:
        return jsonify({"error": "DATABASE_URL is not configured"}), 503
    data = request.get_json(silent=True) or {}
    body = data.get("body", "")
    if not isinstance(body, str):
        return jsonify({"error": "body must be a string"}), 400
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO demo_items (body)
                VALUES (%s)
                RETURNING id, body, created_at
                """,
                (body,),
            )
            row = cur.fetchone()
        conn.commit()
    return jsonify(_json_row(row)), 201


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
