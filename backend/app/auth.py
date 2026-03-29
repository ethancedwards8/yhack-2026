import logging
import os
from functools import wraps

import jwt
from flask import request, jsonify, g
from supabase import create_client

logger = logging.getLogger(__name__)


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def verify_token(token: str) -> dict:
    secret = os.environ["SUPABASE_JWT_SECRET"]
    return jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            claims = verify_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {e}"}), 401

        g.user_claims = claims
        g.user_id = claims["sub"]

        try:
            sb = _get_supabase()
            user_meta = claims.get("user_metadata", {})
            payload = {
                "user_id": claims["sub"],
                "name": user_meta.get("full_name", ""),
                "email": claims.get("email", ""),
                "bias": 0.5,
            }
            if user_meta.get("state"):
                payload["state"] = user_meta["state"]
            logger.info("Upserting user: %s", payload)
            result = sb.table("users").upsert(payload, on_conflict="user_id").execute()
            logger.info("Upsert result: %s", result)
        except Exception:
            logger.exception("Failed to upsert user")

        return f(*args, **kwargs)
    return decorated
