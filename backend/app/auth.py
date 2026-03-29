import os
from functools import wraps

import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g
from supabase import create_client

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        domain = os.environ["AUTH0_DOMAIN"]
        _jwks_client = PyJWKClient(f"https://{domain}/.well-known/jwks.json")
    return _jwks_client


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def verify_token(token: str) -> dict:
    domain = os.environ["AUTH0_DOMAIN"]

    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=f"https://{domain}/",
        options={"verify_aud": False},
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

        # Upsert user to Supabase
        sb = _get_supabase()
        sb.table("users").upsert({
            "user_id": claims["sub"],
            "name": claims.get("name", claims.get("nickname", "")),
            "email": claims.get("email", ""),
        }, on_conflict="user_id").execute()

        return f(*args, **kwargs)
    return decorated
