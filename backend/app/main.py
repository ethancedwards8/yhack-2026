import logging
import os
import sys
from functools import lru_cache
from pathlib import Path
import pandas as pd
import requests
import time

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
from app.algorithm import elo_alg, user_bias_alg

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

CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"])


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


@app.route("/me/votes")
@require_auth
def me_votes():
    """Return all bills the current user has swiped on, with their vote."""
    sb = _get_supabase()
    try:
        result = (
            sb.table("swipes")
            .select("bill_id, agree, created_at, bills(bill_id, title, description, state, party, bill_elo, pdf_url)")
            .eq("user_id", g.user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.exception("GET /me/votes failed for user_id=%s", g.user_id)
        return jsonify({"error": "failed to fetch votes", "details": str(exc)}), 500

    votes = []
    for row in (result.data or []):
        bill = row.get("bills") or {}
        votes.append({
            "bill_id": row["bill_id"],
            "agree": row["agree"],
            "voted_at": row.get("created_at"),
            "title": bill.get("title"),
            "description": bill.get("description"),
            "state": bill.get("state"),
            "party": bill.get("party"),
            "bill_elo": bill.get("bill_elo"),
            "pdf_url": bill.get("pdf_url"),
        })

    return jsonify(votes)


@app.route("/me", methods=["PATCH"])
@require_auth
def update_me():
    data = request.get_json(silent=True) or {}
    allowed = {k: v for k, v in data.items() if k in ("state", "bias", "name", "avatar_url")}
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


@app.route("/register_swipe", methods=["POST"])
def register_swipe():
    sb = _get_supabase()
    data = request.get_json(silent=True) or {}
    bill_id = data.get("bill_id")
    user_id = data.get("user_id")
    user_vote = data.get("user_vote")
    
    if bill_id is None or user_id is None or user_vote is None:
        return jsonify({"error": "bill_id, user_id, and user_vote are required"}), 400
    
    try:
        bill_id = int(bill_id)
        user_vote = int(user_vote)
    except (TypeError, ValueError):
        return jsonify({"error": "bill_id and user_vote must be integers"}), 400

    bill = (
        sb.table("bills")
        .select("bill_id")
        .eq("bill_id", bill_id)
        .single()
        .execute()
        .data
    )
    if not bill:
        return jsonify({"error": "bill not found", "bill_id": bill_id}), 404

    user = (
        sb.table("users")
        .select("user_id")
        .eq("user_id", str(user_id))
        .single()
        .execute()
        .data
    )
    if not user:
        return jsonify({"error": "user not found", "user_id": user_id}), 404
    
    vote = (
        sb.table("swipes")
        .select("id")
        .eq("bill_id", bill_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if vote:
        return jsonify({"error": "vote already cast???"}), 403
    
    resp = sb.table("swipes").insert({
        "bill_id": bill_id,
        "user_id": user_id,
        "agree": 1
    }).execute()
    
    return jsonify(), 200
    

@app.route("/leaderboard/<user_id>", methods=["GET"])
def get_leaderboard(user_id):
    sb = _get_supabase()

    result = (
        sb.table("users")
        .select("user_id,bias,name,email,state")
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if not result.data:
        return jsonify({"error": "could not find user"}), 404

    state = result.data[0].get("state")
    uid = result.data[0].get("user_id")

    swipe_result = (
        sb.table("swipes")
        .select("bill_id")
        .eq("user_id", uid)
        .execute()
    )

    swiped_ids = set(s["bill_id"] for s in swipe_result.data)

    bills_result = (
        sb.table("bills")
        .select("*")
        .eq("state", state)
        .order("bill_elo", desc=True)
        .limit(10)
        .execute()
    )

    leaderboard = []
    for bill in bills_result.data:
        leaderboard.append({
            **bill,
            "visible": bill["bill_id"] in swiped_ids
        })

    return jsonify({
        "leaderboard": leaderboard
    })


@app.route("/elo", methods=["POST"])
def update_elo():
    sb = _get_supabase()
    data = request.get_json(silent=True) or {}

    bill_id_raw = data.get("bill_id")
    user_id = data.get("user_id")
    user_vote_raw = data.get("user_vote")

    if bill_id_raw is None or user_id is None or user_vote_raw is None:
        return jsonify({"error": "bill_id, user_id, and user_vote are required"}), 400

    try:
        bill_id = int(bill_id_raw)
        user_vote = int(user_vote_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "bill_id and user_vote must be integers"}), 400

    bill = (
        sb.table("bills")
        .select("party")
        .eq("bill_id", bill_id)
        .maybe_single()
        .execute()
    )
    if not bill.data:
        return jsonify({"error": "bill not found", "bill_id": bill_id}), 404
    
    bill = bill.data

    user = (
        sb.table("users")
        .select("bias")
        .eq("user_id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not user.data:
        return jsonify({"error": "user not found", "user_id": user_id}), 404
    
    user = user.data

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

    new_bias = user_bias_alg(
        user_bias=user_bias,
        bill_bias=bill_bias,
        user_vote=user_vote,
    )
    sb.table("users").update({"bias": new_bias}).eq("user_id", str(user_id)).execute()
    
    vote_resp = (
        sb.table("swipes")
        .select("id")
        .eq("bill_id", bill_id)
        .eq("user_id", str(user_id))
        .execute()
    )

    votes = vote_resp.data or []

    if len(votes) == 0:
        insert_resp = sb.table("swipes").insert({
            "bill_id": bill_id,
            "user_id": user_id,
            "agree": user_vote
        }).execute()

        return jsonify({"bill_id": bill_id, "delta": delta, "new_elo": new_elo, "new_user_bias": new_bias})
    else:
        return jsonify({"error": "vote already cast"}), 403
    


@app.route("/match", methods=["POST"])
def get_match_users():
    sb = _get_supabase()
    data = request.get_json(force=True, silent=True)
    logger.info("/match raw body: %r", request.get_data(as_text=True))
    logger.info("/match parsed data: %r", data)
    data = data or {}

    user_id_raw = data.get("user_id")
    take_raw = data.get("take", 5)

    if user_id_raw is None:
        return jsonify({"error": "user_id is required", "received": data}), 400

    user_id = str(user_id_raw).strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    try:
        take = int(take_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "take must be an integer"}), 400

    try:
        rpc_result = (
            sb.rpc(
                "get_match_users",
                {
                    "p_user_id": user_id,
                    "p_take": take,
                },
            )
            .execute()
        )
    except Exception as exc:
        return jsonify({"error": "failed to fetch matches", "details": str(exc)}), 500

    return jsonify({
        "user_id": user_id,
        "take": take,
        "matches": rpc_result.data or [],
    })

@app.route("/user/<user_id>")
def get_user(user_id):
    try:
        sb = _get_supabase()
        result = (
            sb.table("users")
            .select("user_id,bias,name,email,avatar_url")
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
            "avatar_url": row.get("avatar_url"),
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
            "description": row.get("description"),
            "text": row.get("text"),

        }
    )


@app.route("/legiscan/bill/<int:bill_id>")
def get_legiscan_bill(bill_id):
    bill = legis.get_bill(bill_id)
    return jsonify(bill)

import tempfile
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_JUSTIFY
from google import genai
from google.genai import types
import re

SINCH_SECRET=os.getenv("SINCH_SECRET")

# Initialize client once at module level — picks up GEMINI_API_KEY from env
_genai_client = genai.Client()

def clean_number(num):
    if not num or num == "Not Found":
        return None
    digits = re.sub(r"\D", "", str(num))
    if not digits:
        return None
    return f"+1{digits}"

def generate_opposition_letter(bill_description: str, reason: str, senator_name: str, full_text: str) -> str:
    print("generating")
    """Call Gemini 2.5 Flash to write a formal opposition letter."""
    response = _genai_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"""Write a formal, professional letter from a concerned constituent to Senator {senator_name} 
opposing a piece of legislation. The letter should:
- Open with a formal salutation to Senator {senator_name}
- Clearly state opposition to the bill
- Reference the bill's subject matter and why it is harmful
- Include the constituent's reason for opposition
- Close with a respectful call to action urging a NO vote
- End with "Sincerely," followed by signing off with "A Concerned Citizen".
- DO NOT leave any placeholders, disregard common fields if not provided with explicit information (like address). 

Bill description: {bill_description}
Constituent's reason for opposition: {reason}
Bill full text: {full_text}

Return only the letter text, no extra commentary.""",
        config=types.GenerateContentConfig(
            max_output_tokens=50000,
            temperature=0.4,
        ),
    )
    return response.text



def build_letter_pdf(letter_text: str) -> str:
    """Render letter_text into a temp PDF. Returns the temp file path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()

    doc = SimpleDocTemplate(
        tmp.name,
        pagesize=letter,
        leftMargin=1.25 * inch,
        rightMargin=1.25 * inch,
        topMargin=1.5 * inch,
        bottomMargin=1.5 * inch,
    )

    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=10,
    )

    story = []
    for para in letter_text.strip().split("\n\n"):
        cleaned = para.strip().replace("\n", " ")
        if cleaned:
            story.append(Paragraph(cleaned, body_style))
            story.append(Spacer(1, 0.1 * inch))

    doc.build(story)
    return tmp.name


@app.route("/fax", methods=["POST", "OPTIONS"])
def send_fax():
    if request.method == "OPTIONS":
        return "", 204
    sb = _get_supabase()
    data = request.get_json(silent=True) or {}

    bill_id = data.get("bill_id")
    state   = data.get("state")
    reason  = data.get("reason")

    if not state:
        return jsonify({"error": "state required"}), 400
    if not bill_id:
        return jsonify({"error": "bill_id required"}), 400
    if not reason:
        return jsonify({"error": "reason required"}), 400

    # Fetch bill description from Supabase
    bill_resp = (
        sb.table("bills")
        .select("description,text")
        .eq("bill_id", bill_id)
        .limit(1)
        .execute()
    )
    bill_description = (
        bill_resp.data[0]["description"] if bill_resp.data else "Unknown legislation"
    )
    bill_text = (
        bill_resp.data[0]["text"] if bill_resp.data else "Unknown legislation"
    )

    # Load and filter senators CSV
    df = pd.read_csv(str(Path(__file__).parent / "senators.csv"), header=None, names=["state", "name", "party", "fax"])
    senators = df[df["state"].str.lower() == state.lower()]

    if senators.empty:
        return jsonify({"error": "No senators found"}), 404

    results = []

    for _, row in senators.iterrows():
        fax_number = clean_number(row["fax"])
        if not fax_number:
            continue

        pdf_path = None
        try:
            letter_text = generate_opposition_letter(bill_description, reason, row["name"], bill_text)
            pdf_path = build_letter_pdf(letter_text)

            with open(pdf_path, "rb") as pdf_file:
                project_id = "6ecab141-9597-420a-84a7-3b480b43a8a2"
                url = "https://fax.api.sinch.com/v3/projects/" + project_id + "/faxes"

                response = requests.post(
                    url,
                    files={"file": ("letter.pdf", pdf_file, "application/pdf")},
                    data={"to": fax_number},
                    auth=('fedd7e2d-1729-47c5-90de-9ec5d5878cad', SINCH_SECRET)
                )

            fax_result = response.json()

            results.append({
                "name": row["name"],
                "fax": fax_number,
                "status_code": response.status_code,  # from response object
                "response": fax_result,               # the parsed JSON
            })

        except Exception as e:
            results.append({
                "name": row["name"],
                "fax": fax_number,
                "error": str(e),
            })

        finally:
            if pdf_path and os.path.exists(pdf_path):
                os.unlink(pdf_path)

    return jsonify(results)


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG", "false").strip().lower() == "true",
    )
