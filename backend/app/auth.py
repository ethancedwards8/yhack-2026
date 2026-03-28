"""
Auth0 JWT validation and authentication utilities.

This module handles JWT validation from Auth0 (third-party auth in Supabase).
It validates tokens from the Authorization header and extracts user information
for use in RLS policies.
"""

import os
import functools
from typing import Optional, Any, Dict

from flask import request, jsonify, g
from jose import JWTError, jwt
import requests


class Auth0Error(Exception):
    """Base exception for Auth0 authentication errors."""
    pass


class InvalidTokenError(Auth0Error):
    """Raised when the JWT token is invalid or expired."""
    pass


class MissingTokenError(Auth0Error):
    """Raised when the Authorization header is missing."""
    pass


# ============================================================================
# JWKS Cache and Token Validation
# ============================================================================

_jwks_cache: Optional[Dict[str, Any]] = None


def get_auth0_domain() -> str:
    """Get Auth0 domain from environment."""
    domain = os.environ.get("AUTH0_DOMAIN")
    if not domain:
        raise ValueError("AUTH0_DOMAIN environment variable is not set")
    return domain


def get_jwks() -> Dict[str, Any]:
    """
    Fetch Auth0 JWKS from the .well-known endpoint.
    
    Caches the result to avoid repeated HTTP calls.
    """
    global _jwks_cache
    
    if _jwks_cache is not None:
        return _jwks_cache
    
    domain = get_auth0_domain()
    jwks_uri = f"https://{domain}/.well-known/jwks.json"
    
    try:
        response = requests.get(jwks_uri, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache
    except requests.RequestException as e:
        raise Auth0Error(f"Failed to fetch JWKS from {jwks_uri}: {e}")


def validate_token(token: str) -> Dict[str, Any]:
    """
    Validate an Auth0 JWT token.
    
    Verifies:
    - Token signature (using Auth0 JWKS)
    - Issuer (iss) is the Auth0 domain
    - Audience (aud) includes "authenticated"
    
    Args:
        token: The JWT token (without "Bearer " prefix)
        
    Returns:
        Decoded token payload
        
    Raises:
        InvalidTokenError: If token is invalid or validation fails
    """
    domain = get_auth0_domain()
    issuer = f"https://{domain}/"
    
    try:
        # Get the signing key
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        key_id = unverified_header.get("kid")
        
        if not key_id:
            raise InvalidTokenError("Token header missing 'kid'")
        
        # Find the matching key in JWKS
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == key_id:
                key = k
                break
        
        if not key:
            raise InvalidTokenError(f"No matching key found for kid: {key_id}")
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=issuer,
            audience="authenticated",
        )
        
        return payload
        
    except JWTError as e:
        raise InvalidTokenError(f"Token validation failed: {e}")


def get_bearer_token() -> Optional[str]:
    """
    Extract the Bearer token from the Authorization header.
    
    Returns:
        The token (without "Bearer " prefix), or None if not found
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]


# ============================================================================
# Flask Integration
# ============================================================================

def requires_auth(f):
    """
    Decorator to require Auth0 authentication for a Flask route.
    
    Validates the JWT token from the Authorization header and stores
    the user context in `flask.g.user_info` for use in the route handler.
    
    Usage:
        @app.route("/api/bills")
        @requires_auth
        def get_bills():
            user_id = g.user_info["sub"]
            ...
    
    Raises:
        MissingTokenError: If Authorization header is missing
        InvalidTokenError: If token is invalid or validation fails
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_bearer_token()
        
        if not token:
            return jsonify({
                "error": "Unauthorized",
                "message": "Missing or invalid Authorization header",
            }), 401
        
        try:
            user_info = validate_token(token)
            g.user_info = user_info
            return f(*args, **kwargs)
        except InvalidTokenError as e:
            return jsonify({
                "error": "Unauthorized",
                "message": str(e),
            }), 401
    
    return decorated_function


def get_current_user() -> Dict[str, Any]:
    """
    Get the current authenticated user info from the request context.
    
    Must only be called from within a route protected by @requires_auth.
    
    Returns:
        Dictionary containing:
        - sub: User ID (unique identifier)
        - email: User email
        - role: "authenticated"
        - (other claims from the Auth0 token)
    """
    if not hasattr(g, "user_info"):
        raise RuntimeError(
            "get_current_user() called outside of authenticated context. "
            "Ensure route is protected with @requires_auth"
        )
    return g.user_info
