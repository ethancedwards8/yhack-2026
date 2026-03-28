"""
Supabase client configuration for server-side RLS validation.

This module creates Supabase clients for backend API routes:
1. User-authenticated client: Uses Auth0 JWT for RLS enforcement
2. Service client: Uses service_role key (internal operations only)

The user-authenticated client ensures that:
- Supabase validates the JWT via Auth0 third-party issuer
- RLS policies control what each user can read/write
- The backend never exposes service_role key to clients
"""

import os
from typing import Optional
from supabase import create_client, Client
from flask import g


def get_supabase_config() -> dict:
    """Get Supabase configuration from environment."""
    url = os.environ.get("SUPABASE_URL")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY")

    if not url or not publishable_key:
        raise ValueError(
            "Missing Supabase environment variables:\n"
            "  - SUPABASE_URL\n"
            "  - SUPABASE_PUBLISHABLE_KEY\n\n"
            "Set these in backend/.env\n"
            "Get them from: Supabase Dashboard → Settings → API"
        )

    return {
        "url": url,
        "publishable_key": publishable_key,
        "secret_key": secret_key,
    }


def create_user_client(auth_token: str) -> Client:
    """
    Create a Supabase client for a user-authenticated request.

    This client uses the Auth0 JWT token, so Supabase RLS policies will:
    - Validate the JWT via Auth0 third-party issuer
    - Extract user ID from token "sub" claim
    - Apply RLS policies to filter data by user_id

    Args:
        auth_token: Auth0 JWT token (without "Bearer " prefix)

    Returns:
        Supabase client configured for this user

    Example:
        # In a protected route handler:
        from app.supabase_rls import create_user_client

        @app.route("/api/votes")
        @requires_auth
        def get_votes():
            token = get_bearer_token()
            supabase = create_user_client(token)

            # This query will only return the authenticated user's votes
            # due to RLS policies
            votes = supabase.table("votes").select("*").execute()
            return votes.data
    """
    config = get_supabase_config()

    return create_client(
        config["url"],
        config["publishable_key"],
        {
            "auth": {
                "persistSession": False,
                "autoRefreshToken": False,
                "detectSessionInUrl": False,
            },
            "headers": {
                "Authorization": f"Bearer {auth_token}",
            },
        },
    )


def create_service_client() -> Client:
    """
    Create a Supabase client with service_role key for internal operations.

    ⚠️  DANGER: The service_role key bypasses RLS policies!

    Only use this for:
    - Admin operations
    - Batch imports
    - Internal data processing

    NEVER expose this client to frontend. NEVER use it to directly respond
    to user requests without proper authorization checks.

    Returns:
        Supabase client with full access (bypasses RLS)

    Example:
        # INTERNAL ONLY - not called from API routes
        from app.supabase_rls import create_service_client

        def internal_batch_import_bills(bill_data):
            supabase = create_service_client()
            # This bypasses RLS - only used for admin operations
            supabase.table("bills").upsert(bill_data).execute()
    """
    config = get_supabase_config()

    if not config["secret_key"]:
        raise ValueError(
            "secret_key not configured in environment. "
            "Set SUPABASE_SECRET_KEY in backend/.env\n"
            "Get it from: Supabase Dashboard → Settings → API → Secret"
        )

    return create_client(
        config["url"],
        config["secret_key"],
    )


def get_current_supabase_client() -> Optional[Client]:
    """
    Get the Supabase client for the current request.

    This is automatically set by middleware for authenticated requests.
    Use in route handlers to query data with RLS enforcement.

    Returns:
        Supabase client configured with user's Auth0 JWT, or None if
        not in an authenticated request context
    """
    return getattr(g, "supabase_client", None)
