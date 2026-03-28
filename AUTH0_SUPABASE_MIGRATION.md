# Auth0 + Supabase RLS Migration Guide

## Overview

This codebase uses **Auth0 as the only authentication provider** with **Supabase Postgres + RLS** for data access control. 

**Key Security Principle**: The frontend NEVER connects directly to Supabase. All database queries go through the Flask backend:

```
Frontend (Next.js)
    ↓ HTTP request + Auth0 JWT
Flask Backend
    ├─ Validates JWT with Auth0 JWKS
    ├─ Creates Supabase client with JWT
    └─ Queries Supabase (RLS enforced)
        ↓
Supabase (validates JWT + applies Row Level Security)
    ├─ Extracts user ID from JWT "sub" claim
    ├─ Applies RLS policies
    └─ Returns only authorized data
```

The JWT is validated at **two levels**:
1. **Backend** - Validates signature using Auth0 JWKS
2. **Supabase** - Validates signature via Auth0 third-party issuer, applies RLS

---

## 1. Auth0 Configuration

### 1.1 Create an Auth0 Action (Add Custom Claims)

Auth0 needs to issue tokens with custom claims that Supabase RLS policies will use.

**Steps:**

1. Go to **Auth0 Dashboard** → **Actions** → **Flows** → **Login**
2. Click **"+"** to create a new Action
3. Name it: `Add Custom Claims`
4. Replace the default code with:

```javascript
/**
 * Adds custom claims to the access token for use in Supabase RLS policies.
 * 
 * The token will include:
 * - sub: User ID (unique identifier)
 * - email: User email address
 * - role: "authenticated" (for RLS policies)
 * - aud: "authenticated" (audience for Supabase)
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://api.legisbrowser.app/";
  
  // Add custom claims
  api.accessToken.setCustomClaim("role", "authenticated");
  api.accessToken.setCustomClaim("email", event.user.email);
  
  // Important: Ensure the audience includes "authenticated" for Supabase
  // This is typically set in the Auth0 API configuration
};
```

5. Click **"Deploy"**
6. Go back to **Login flow** and ensure this Action is added

### 1.2 Configure Auth0 API

1. Go to **Auth0 Dashboard** → **Applications** → **APIs**
2. Click **"Create API"** or select your existing API
3. Set:
   - **Name**: `authenticated`
   - **Identifier**: `authenticated`
4. Under **Settings** → **RBAC Settings**:
   - Enable **"Add permissions in the access token"**

### 1.3 Configure Auth0 Regular Web Application

1. Go to **Auth0 Dashboard** → **Applications** → **Applications**
2. Find your Next.js application (or create one)
3. Set **Application Type** to `"Regular Web Application"`
4. Under **Settings**:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback,https://yourdomain.com/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000,https://yourdomain.com`
   - **Allowed Origins (CORS)**: `http://localhost:3000,https://yourdomain.com`

5. Save these values in your `.env.local`:
   ```env
   AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com
   AUTH0_CLIENT_ID=your_client_id
   AUTH0_CLIENT_SECRET=your_client_secret
   AUTH0_SECRET=32-character-random-string  # Use: openssl rand -hex 32
   ```

---

## 2. Flask Backend Configuration

### 2.1 How Backend Handles Authentication

The Flask backend acts as a **security boundary**:

1. Receives requests from frontend with Auth0 JWT in `Authorization` header
2. Validates JWT signature using Auth0 JWKS
3. Creates a Supabase client with the JWT token
4. Supabase validates JWT and applies RLS policies
5. Returns only data the user is authorized to see

**Key Files**:
- `app/auth.py` - JWT validation and `@requires_auth` decorator
- `app/supabase_rls.py` - Supabase client creation with RLS support
- `app/main.py` - Protected routes that query Supabase

### 2.2 Backend Environment Variables

Set these in `backend/.env`:

```env
AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com
SUPABASE_URL=https://kempwxnttjdhktqzyvws.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...  # 🔒 KEEP SECRET
LEGISCAN_API_KEY=...
```

### 2.3 Creating Protected Routes with Supabase

```python
from app.auth import requires_auth, get_current_user, get_bearer_token
from app.supabase_rls import create_user_client

@app.route("/api/votes", methods=["GET"])
@requires_auth
def get_user_votes():
    """Get all votes for the current user (RLS enforces this)."""
    token = get_bearer_token()
    supabase = create_user_client(token)
    
    # This query respects RLS - only returns your votes
    response = supabase.table("votes").select("*").execute()
    return jsonify(response.data)


@app.route("/api/votes", methods=["POST"])
@requires_auth
def create_vote():
    """Submit a vote (RLS prevents voting as another user)."""
    user_id = get_current_user()["sub"]
    token = get_bearer_token()
    data = request.get_json()
    
    supabase = create_user_client(token)
    
    # RLS policy will reject if user_id doesn't match JWT "sub"
    response = supabase.table("votes").insert({
        "user_id": user_id,
        "bill_id": data["bill_id"],
        "vote": data["vote"],
    }).execute()
    
    return jsonify(response.data), 201
```

---

## 3. Supabase Configuration (Third-Party Auth + RLS)

### 3.1 Enable Third-Party Authentication (Auth0)

**Steps:**

1. Go to **Supabase Dashboard** → **Settings** → **Authentication**
2. Under **External OAuth Providers**, find **Auth0**
3. Enable it and configure:
   - **Issuer URL**: `https://dev-XXXXXXXX.us.auth0.com/`
   - **JWKS URI**: `https://dev-XXXXXXXX.us.auth0.com/.well-known/jwks.json`

> ⚠️ **Important**: The JWKS URI should be **auto-discovered**. You typically only need to set the Issuer URL, and Supabase will fetch the JWKS automatically.

### 3.2 Create RLS Policies

RLS policies use `auth.jwt()` to read claims from the Auth0 token. Reference the user ID with `(auth.jwt() ->> 'sub')::text`.

**Example policy (for a `votes` table):**

```sql
-- Enable RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own votes
CREATE POLICY votes_user_select
  ON votes
  FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Policy: Users can insert their own votes
CREATE POLICY votes_user_insert
  ON votes
  FOR INSERT
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')::uuid
    AND user_id IS NOT NULL
  );
```

**For public data (no user_id required):**

```sql
-- Require role = "authenticated" for INSERT/UPDATE/DELETE
-- but allow anyone to SELECT public data
CREATE POLICY bills_public_select
  ON bills
  FOR SELECT
  USING (true);  -- Everyone can read

CREATE POLICY bills_authenticated_write
  ON bills
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'authenticated');
```

---

## 4. Environment Variables

### 4.1 Frontend (.env.local)

```env
# Auth0 - Copy from Auth0 Dashboard → Applications → Settings
AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com
AUTH0_CLIENT_ID=0VWRNlujHklqXBwfQXVPntuVieghUyqI
AUTH0_CLIENT_SECRET=VVThRFa7HZS7vRU7sL3D61koZ7gyIjIlj55HE-uk4xxMcP_LiB0xOmiKYVz9lB-P
AUTH0_SECRET=4ada3d4805939eafb2603819c3c4e76cf23262555d7705ab52571141d0d3be95

# Application
APP_BASE_URL=http://localhost:3000

# ⚠️  NOTE: Frontend does NOT have direct Supabase access
# All database queries go through the Flask backend API
```

### 4.2 Backend (.env)

⚠️ **Important**: Backend has access to Supabase secrets. Keep this file private.

```env
# Auth0
AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com

# LegiScan API
LEGISCAN_API_KEY=your_legiscan_api_key

# Supabase - Get these from: Supabase Dashboard → Settings → API
# NOTE: The service_role key is sensitive - NEVER expose to frontend
SUPABASE_URL=https://kempwxnttjdhktqzyvws.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (KEEP SECRET)

# Flask
FLASK_ENV=development
```

**Setting backend secrets**:
1. Open Supabase Dashboard
2. Go to **Settings → API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **Anon/Public Key** → `SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` (🔒 NEVER share)

---

## 5. Testing the Migration

### 5.1 Test Auth0 Login

1. Go to `http://localhost:3000`
2. Click **Login** (or navigate to `/api/auth/login`)
3. You should be redirected to Auth0
4. After login, you should be redirected back to your app
5. Check that the token is stored (inspect cookies in DevTools)

### 5.2 Test Backend Authentication

```bash
# Get your Auth0 token (from browser DevTools, Application tab → Cookies → auth0-token)
TOKEN="your_auth0_token_here"

# Verify the token contains correct claims
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/search?q=healthcare&state=CA

# Expected response: Bills matching your search
# If you get 401, check that Auth0 Action is deployed and token includes "role"
```

### 5.3 Test Supabase RLS

1. Get your Auth0 token from the browser
2. Test a backend API route that queries Supabase:
   ```bash
   TOKEN="your_auth0_token_here"
   
   # Get your votes (RLS will only return your votes)
   curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/votes
   
   # Create a vote
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"bill_id": 12345, "vote": "yes"}' \
     http://localhost:8000/api/votes
   ```

3. Verify RLS is working by querying Supabase SQL Console:
   ```sql
   -- Should see the vote you just created
   SELECT * FROM votes;
   ```

   If RLS policies are working correctly, you should only see your votes, not other users' votes.

---

## 6. Token Structure

### Auth0 Token Payload

After all configurations, your token should look like:

```json
{
  "sub": "auth0|507f191e810c19729de860ea",
  "email": "user@example.com",
  "aud": ["authenticated", "https://api.legisbrowser.app/"],
  "iss": "https://dev-XXXXXXXX.us.auth0.com/",
  "role": "authenticated",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Claims Used

- **sub**: User ID uniquely identifying the user (used in RLS policies)
- **email**: User email address
- **role**: Set to `"authenticated"` for all logged-in users (used in RLS policies)
- **aud**: Audience, includes `"authenticated"` for Supabase validation
- **iss**: Issuer URL (validates token came from your Auth0 domain)

---

## 7. Troubleshooting

### Problem: 401 Unauthorized on backend routes

**Solution**: 
1. Verify `AUTH0_DOMAIN` is set correctly in `.env`
2. Check that Auth0 Action is **deployed**
3. Verify token includes `"role": "authenticated"` (inspect in `jwt.io`)
4. Ensure `Bearer ` prefix is used correctly in Authorization header

### Problem: Supabase RLS rejects queries

**Solution**:
1. Check `auth.jwt() ->> 'sub'` matches the `user_id` column type (likely UUID)
2. Verify JSON casting: `(auth.jwt() ->> 'sub')::uuid` or `::text`
3. Enable RLS logging to see which policy is blocking:
   ```sql
   -- In Supabase, use the audit logs to see RLS rejections
   ```

### Problem: Token refresh failing on backend

**Solution**:
1. In Server Components, tokens cannot be automatically refreshed back to cookies
2. Use Route Handlers or `getAccessToken()` with proper error handling
3. For long-running operations, consider using Server Actions with explicit token passing

---

## 8. Migration Checklist

- [ ] Auth0 Domain and credentials in `backend/.env` and `frontend/.env.local`
- [ ] **Frontend does NOT have NEXT_PUBLIC_SUPABASE_* variables**
- [ ] Backend has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Auth0 Action created and deployed (adds custom claims)
- [ ] Auth0 API configured with custom claims
- [ ] Auth0 Application (Regular Web) configured with correct URLs
- [ ] Supabase third-party JWT configured (Auth0 issuer + JWKS)
- [ ] Backend routes protected with `@requires_auth` decorator
- [ ] Backend routes use `create_user_client(token)` to query Supabase with RLS
- [ ] RLS policies created in Supabase (using `auth.jwt() ->> 'sub'`)
- [ ] Backend dependencies installed (`pip install -e .`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Test login flow works end-to-end
- [ ] Test backend authorization with Bearer token
- [ ] Test backend API routes that query Supabase
- [ ] Verify Supabase RLS policies are filtering data correctly (only user's own data returned)

---

## 9. Additional Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Next.js SDK](https://auth0.com/docs/get-started/authentication-and-authorization-flow/call-your-api)
- [Supabase Third-Party JWT](https://supabase.com/docs/guides/auth/third-party-oauth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT.io - Inspect tokens](https://jwt.io)

