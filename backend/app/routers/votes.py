import logging
import os
from flask import Blueprint, jsonify, request, g
from supabase import create_client

from app.algorithm import elo_alg, user_bias_alg
from app.auth import require_auth

logger = logging.getLogger(__name__)

votes_bp = Blueprint("votes", __name__, url_prefix="/vote")

_PARTY_TO_BIAS = {
    "Democratic": 0,
    "Republican": 1,
    "Independent": 2,
}


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@votes_bp.route("", methods=["POST"])
@require_auth
def vote():
    data = request.get_json(silent=True) or {}
    bill_id = data.get("bill_id")
    user_vote = data.get("user_vote")

    if bill_id is None or user_vote is None:
        return jsonify({"error": "bill_id and user_vote are required"}), 400

    sb = _get_supabase()

    bill = sb.table("bills").select("bill_elo, party").eq("bill_id", bill_id).single().execute().data
    user = sb.table("users").select("bias").eq("user_id", g.user_id).single().execute().data

    if not bill:
        return jsonify({"error": "bill not found"}), 404
    if not user:
        return jsonify({"error": "user not found"}), 404

    bill_bias = _PARTY_TO_BIAS.get(bill.get("party"), 2)
    new_elo = elo_alg(
        elo=bill["bill_elo"],
        bill_bias=bill_bias,
        user_bias=user["bias"],
        user_vote=user_vote,
    )

    logger.info(
        "vote: bill_id=%s user_id=%s user_vote=%s old_elo=%s new_elo=%s party=%s",
        bill_id, g.user_id, user_vote, bill["bill_elo"], new_elo, bill.get("party"),
    )

    sb.table("bills").update({"bill_elo": new_elo}).eq("bill_id", bill_id).execute()

    current_bias = float(user["bias"]) if user["bias"] is not None else 0.5
    new_bias = user_bias_alg(
        user_bias=current_bias,
        bill_bias=bill_bias,
        user_vote=user_vote,
    )
    sb.table("users").update({"bias": new_bias}).eq("user_id", g.user_id).execute()
    
    vote_resp = (
        sb.table("swipes")
        .select("id")
        .eq("bill_id", bill_id)
        .eq("user_id", str(g.user_id))
        .execute()
    )

    votes = vote_resp.data or []

    if len(votes) == 0:
        insert_resp = sb.table("swipes").insert({
            "bill_id": bill_id,
            "user_id": g.user_id,
            "agree": user_vote
        }).execute()

        return jsonify({"bill_id": bill_id, "new_elo": new_elo, "new_user_bias": new_bias})
    else:
        return jsonify({"error": "vote already cast"}), 403
