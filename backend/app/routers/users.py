import os
from flask import Blueprint, jsonify
from supabase import create_client

users_bp = Blueprint("users", __name__, url_prefix="/user")


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@users_bp.route("/<user_id>")
def get_user(user_id):
    sb = _get_supabase()
    result = sb.table("users").select("*").eq("user_id", user_id).single().execute()
    return jsonify(result.data)
