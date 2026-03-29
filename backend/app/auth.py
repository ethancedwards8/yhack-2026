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


def optional_auth(f):
    """Like require_auth but doesn't reject unauthenticated requests.
    Sets g.user_id if a valid token is present, otherwise leaves it unset."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            try:
                claims = verify_token(token)
                g.user_id = claims["sub"]
                g.user_claims = claims
            except jwt.InvalidTokenError:
                pass
        return f(*args, **kwargs)
    return decorated


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
            user_id = claims["sub"]
            email = claims.get("email", "")
            full_name = user_meta.get("full_name", "").strip()
            state = user_meta.get("state", "").strip()

            # Insert the row only if it doesn't exist yet (ignore conflicts)
            # This prevents every request from overwriting user-editable fields like name
            new_row: dict = {"user_id": user_id, "email": email}
            if full_name:
                new_row["name"] = full_name
            if state:
                new_row["state"] = state
            logger.info("Inserting user if not exists: %s", new_row)
            result = sb.table("users").upsert(new_row, on_conflict="user_id", ignore_duplicates=True).execute()
            logger.info("Insert result: %s", result)

            # Always keep email in sync (non-destructive to other fields)
            sb.table("users").update({"email": email}).eq("user_id", user_id).execute()

            # Set default bias only for new users (where bias is still NULL)
            sb.table("users").update({"bias": 0.5}).eq(
                "user_id", user_id
            ).is_("bias", "null").execute()
        except Exception:
            logger.exception("Failed to upsert user")

        return f(*args, **kwargs)
    return decorated
