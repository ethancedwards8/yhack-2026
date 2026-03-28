from flask import Flask, jsonify, request, g
from app.legiscan import LegiScan
from app.auth import requires_auth, get_current_user, get_bearer_token
from app.supabase_rls import create_user_client, create_service_client
import uuid

app = Flask(__name__)
legis = LegiScan()  # reads LEGISCAN_API_KEY from environment


@app.route("/health")
def health():
    """Public health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/api/user/sync", methods=["POST"])
@requires_auth
def sync_user():
    """
    Sync Auth0 user info to the database on login.
    
    This endpoint is called by the frontend after Auth0 login to ensure
    the user record exists in the database. It creates or updates the user
    with their Auth0 information.
    
    Returns:
        User object with user_id and name
    """
    user_info = get_current_user()
    token = get_bearer_token()
    
    # Extract user info from Auth0 JWT
    auth0_sub = user_info.get("sub")
    name = user_info.get("name", user_info.get("email", auth0_sub))
    email = user_info.get("email", "")
    
    try:
        # Use service client to write to users table without RLS restrictions
        supabase = create_service_client()
        
        # Check if user already exists (by email as unique identifier)
        existing = supabase.table("users").select("user_id").eq("name", name).execute()
        
        if existing.data and len(existing.data) > 0:
            # User exists, return their record
            user_id = existing.data[0]["user_id"]
            return jsonify({
                "user_id": str(user_id),
                "name": name,
                "auth0_sub": auth0_sub,
            })
        else:
            # Create new user
            new_user = supabase.table("users").insert({
                "name": name,
            }).execute()
            
            if new_user.data and len(new_user.data) > 0:
                user_id = new_user.data[0]["user_id"]
                return jsonify({
                    "user_id": str(user_id),
                    "name": name,
                    "auth0_sub": auth0_sub,
                }), 201
            else:
                return jsonify({"error": "Failed to create user"}), 500
                
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/user/display-name", methods=["GET"])
@requires_auth
def get_display_name():
    """
    Get the display name for the current authenticated user.
    
    This returns the name stored in the database for the current user,
    which can be different from the cached Auth0 profile.
    
    Returns:
        JSON with user_id and name
    """
    user_info = get_current_user()
    token = get_bearer_token()
    
    try:
        supabase = create_user_client(token)
        
        # Get user by name (serves as identifier for now)
        # In a real app, you'd want a more robust user mapping
        # For now, we use the email from Auth0 as the lookup key
        email = user_info.get("email", "")
        
        if not email:
            # Fallback to using name from Auth0
            name = user_info.get("name", user_info.get("email", user_info.get("sub")))
            users = supabase.table("users").select("user_id, name").eq("name", name).execute()
        else:
            # Try to find by email first (if stored)
            users = supabase.table("users").select("user_id, name").eq("name", email).execute()
        
        if users.data and len(users.data) > 0:
            user = users.data[0]
            return jsonify({
                "user_id": str(user["user_id"]),
                "name": user["name"],
            })
        else:
            # Fallback to Auth0 info if not found in database
            name = user_info.get("name", user_info.get("email", "User"))
            return jsonify({
                "user_id": user_info.get("sub"),
                "name": name,
            })
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/search")
@requires_auth
def search():
    """
    Search for bills by query and state.
    
    Requires Auth0 authentication.
    
    Query parameters:
    - q: Search query (required)
    - state: State code (optional, defaults to "ALL")
    """
    user_id = get_current_user()["sub"]
    query = request.args.get("q", "")
    state = request.args.get("state", "ALL")
    
    if not query:
        return jsonify({"error": "Missing required parameter: q"}), 400
    
    results = legis.search(state=state, query=query)
    return jsonify(results)


@app.route("/bill/<int:bill_id>")
@requires_auth
def get_bill(bill_id):
    """
    Get detailed information about a specific bill.
    
    Requires Auth0 authentication.
    
    Args:
        bill_id: The LegiScan bill ID
    """
    user_id = get_current_user()["sub"]
    bill = legis.get_bill(bill_id)
    return jsonify(bill)


# ============================================================================
# Data API Routes - These interact with Supabase and apply RLS
# ============================================================================

@app.route("/api/votes", methods=["GET"])
@requires_auth
def get_user_votes():
    """
    Get all votes for the current user.
    
    Uses Supabase RLS - only returns the current user's votes based on JWT.
    
    Returns:
        List of vote records for this user
    """
    user_id = get_current_user()["sub"]
    token = get_bearer_token()
    
    try:
        supabase = create_user_client(token)
        response = supabase.table("votes").select("*").execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/votes", methods=["POST"])
@requires_auth
def create_vote():
    """
    Submit a vote on a bill.
    
    Supabase RLS ensures votes are associated with the current user.
    
    Request body:
    {
        "bill_id": 12345,
        "vote": "yes"  or "no"
    }
    """
    user_id = get_current_user()["sub"]
    token = get_bearer_token()
    data = request.get_json()
    
    if not data or "bill_id" not in data or "vote" not in data:
        return jsonify({
            "error": "Missing required fields: bill_id, vote"
        }), 400
    
    try:
        supabase = create_user_client(token)
        
        # The RLS policy will automatically validate that user_id matches
        # the current authenticated user, so the frontend cannot vote
        # as another user
        response = supabase.table("votes").insert({
            "user_id": user_id,
            "bill_id": data["bill_id"],
            "vote": data["vote"],
        }).execute()
        
        return jsonify(response.data), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
