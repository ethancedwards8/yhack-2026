import logging
import os
from functools import wraps

import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g
from supabase import create_client

logger = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        supabase_url = os.environ["SUPABASE_URL"]
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        logger.info("Creating JWKS client for %s", jwks_url)
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def verify_token(token: str) -> dict:
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


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
            }
            if user_meta.get("state"):
                payload["state"] = user_meta["state"]
            logger.info("Upserting user: %s", payload)
            result = sb.table("users").upsert(payload, on_conflict="user_id").execute()
            logger.info("Upsert result: %s", result)
            # Set default bias only for new users (where bias is still NULL)
            sb.table("users").update({"bias": 0.5}).eq(
                "user_id", claims["sub"]
            ).is_("bias", "null").execute()
        except Exception:
            logger.exception("Failed to upsert user")

        return f(*args, **kwargs)
    return decorated
