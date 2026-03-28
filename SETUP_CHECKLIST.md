# Auth0 + Supabase RLS Migration - Setup Checklist

This checklist will guide you through the complete migration setup.

## ✅ Phase 1: Code Changes (COMPLETE)

The following have been implemented:

- ✅ Frontend dependencies added to `package.json`
- ✅ Auth0 route handler created (`app/api/auth/[auth0]/route.ts`)
- ✅ Next.js middleware created (`middleware.ts`)
- ✅ ⚠️ Frontend Supabase client removed (`lib/supabase.ts`) - **Frontend does NOT connect to Supabase**
- ✅ Backend JWT validation module created (`app/auth.py`)
- ✅ Backend Supabase RLS client created (`app/supabase_rls.py`)
- ✅ Flask routes updated with `@requires_auth` decorator
- ✅ Backend API routes for data access added (`app/main.py`)
- ✅ Backend dependencies updated (`pyproject.toml`)

**Action**: View the code changes:
```bash
git diff  # See all changes
```

**Security Note**: Frontend has NO direct Supabase access. All database queries go through Flask backend with RLS enforcement.

---

## ✅ Phase 2: Install Dependencies

### Frontend
```bash
cd frontend
npm install  # or pnpm install
cd ..
```

### Backend
```bash
cd backend
pip install -e .  # Install in editable mode with all dependencies
cd ..
```

**Verify**:
```bash
# Frontend - should include Auth0 SDK only
npm list @auth0/nextjs-auth0
# Should NOT have @supabase/supabase-js in frontend

# Backend - should have JWT validation and Supabase RLS client
pip list | grep python-jose
pip list | grep supabase
```

---

## 📋 Phase 3: Auth0 Configuration

Follow these steps in the **Auth0 Dashboard**:

### 3.1 Create Auth0 Action (Custom Claims)
- [ ] Go to **Actions → Flows → Login**
- [ ] Click **"+"** to create new Action
- [ ] Name: `Add Custom Claims`
- [ ] Copy code from [AUTH0_SUPABASE_MIGRATION.md](AUTH0_SUPABASE_MIGRATION.md#11-create-an-auth0-action-add-custom-claims)
- [ ] **Deploy** the Action

**Verify**: The Action should show **"DEPLOYED"** status

### 3.2 Configure Auth0 API
- [ ] Go to **APIs** (or create a new one)
- [ ] Set Name: `authenticated`
- [ ] Set Identifier: `authenticated`
- [ ] Under **Settings → RBAC Settings**, enable: **"Add permissions in the access token"**

### 3.3 Configure Regular Web Application
- [ ] Go to **Applications**
- [ ] Select or create your Next.js application
- [ ] Set **Application Type**: `"Regular Web Application"`
- [ ] Under **Settings**:
  - [ ] **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`  
        (Add production URL later: `https://yourdomain.com/api/auth/callback`)
  - [ ] **Allowed Logout URLs**: `http://localhost:3000`  
        (Add production URL later)
  - [ ] **Allowed Origins (CORS)**: `http://localhost:3000`

- [ ] Save your credentials:
  - `AUTH0_DOMAIN` (e.g., `dev-XXXXXXXX.us.auth0.com`)
  - `AUTH0_CLIENT_ID`
  - `AUTH0_CLIENT_SECRET`

---

## 🔐 Phase 4: Environment Variables

### Frontend (.env.local)

Create/update `frontend/.env.local`:

```env
# Auth0 - Copy from Auth0 Dashboard → Applications → Settings
AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_SECRET=4ada3d4805939eafb2603819c3c4e76cf23262555d7705ab52571141d0d3be95

# Optional
APP_BASE_URL=http://localhost:3000

# ⚠️  DO NOT add NEXT_PUBLIC_SUPABASE_* variables here
# Frontend does NOT connect to Supabase directly
```

### Backend (.env)

Create/update `backend/.env`:

```env
# Auth0
AUTH0_DOMAIN=dev-XXXXXXXX.us.auth0.com

# Supabase - Get from Supabase Dashboard → Settings → API
# ⚠️  SENSITIVE: The service_role_key is a secret - NEVER commit to git
SUPABASE_URL=https://kempwxnttjdhktqzyvws.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (🔒 KEEP SECRET)

# LegiScan
LEGISCAN_API_KEY=your_api_key_here

# Optional
FLASK_ENV=development
```

**Verify**: 
```bash
# Frontend - should have auth0 variables only
cat frontend/.env.local | grep AUTH0

# Backend - should have auth0 AND supabase secrets
cat backend/.env
```

**Security CHECK**:
- ❌ Never commit `backend/.env` to git
- ❌ Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- ✅ Add `backend/.env` to `.gitignore`

---

## 🌐 Phase 5: Supabase Configuration

### 5.1 Enable Third-Party Auth (Auth0)

In **Supabase Dashboard → Settings → Authentication**:

- [ ] Find **External OAuth Providers**
- [ ] Click on **Auth0**
- [ ] **Enable** it
- [ ] Set **Issuer URL**: `https://dev-XXXXXXXX.us.auth0.com/`
- [ ] **JWKS URL** should auto-discover (leave blank if it does)
- [ ] **Save**

**Verify**: Auth0 should show "Enabled" in the OAuth providers list

### 5.2 Create RLS Policies

For each table where you want user isolation, run these SQL queries in Supabase:

**Example: votes table**
```sql
-- Enable RLS for the table
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own votes
CREATE POLICY votes_user_select
  ON votes
  FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Policy: Users can INSERT their own votes
CREATE POLICY votes_user_insert
  ON votes
  FOR INSERT
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')::uuid
    AND user_id IS NOT NULL
  );

-- Policy: Users can UPDATE their own votes
CREATE POLICY votes_user_update
  ON votes
  FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Policy: Users can DELETE their own votes
CREATE POLICY votes_user_delete
  ON votes
  FOR DELETE
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);
```

**For public-read tables** (e.g., bills):
```sql
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

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

## 🧪 Phase 6: Testing

### 6.1 Run Validation Script

```bash
cd /path/to/yhack-2026

# Make the script executable
chmod +x validate-migration.sh

# Run it
./validate-migration.sh
```

### 6.2 Start Services

**Terminal 1: Start Backend**
```bash
cd backend
python -m app.main

# Expected output:
# * Running on http://0.0.0.0:8000
```

**Terminal 2: Start Frontend**
```bash
cd frontend
npm run dev

# Expected output:
# ▲ Next.js 16.2.1
# - ready started server on 0.0.0.0:3000
```

### 6.3 Test Login Flow

1. Open `http://localhost:3000` in your browser
2. Click **Login** (or go to `/api/auth/login`)
3. You should be redirected to Auth0
4. Enter your credentials
5. You should be redirected back to `http://localhost:3000`
6. ✅ If login succeeds, Auth0 is configured correctly

### 6.4 Test Backend Authentication

Get your Auth0 token and test a protected backend route:

```bash
# Get token from browser DevTools (Application → Cookies → auth0-session)
# Or manually test with curl
TOKEN="eyJhbGc..."

# Test a backend route that queries Supabase
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/votes"

# Expected responses:
# 200: Valid token, returns your votes (RLS applied)
# 401: Invalid token, missing Auth0 domain, or action not deployed
# 500: Backend error (check backend logs)
```

If you get `401`, check:
- [ ] `AUTH0_DOMAIN` is set correctly in `backend/.env`
- [ ] Auth0 Action is **deployed** (status = "DEPLOYED" in Auth0 Dashboard)
- [ ] Token includes `role: "authenticated"` claim (inspect at jwt.io)
- [ ] Token includes `aud: "authenticated"` (required by Supabase)

### 6.5 Test Supabase RLS Enforcement

Test that RLS policies are working on the backend:

```bash
# 1. Create a vote as User A
TOKEN_A="eyJhbGc..."
curl -X POST -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"bill_id": 123, "vote": "yes"}' \
  "http://localhost:8000/api/votes"
# Response includes the vote with user_id

# 2. Try to query as User B (different Auth0 account)
TOKEN_B="eyJhbGc..."  # Different user's token
curl -H "Authorization: Bearer $TOKEN_B" \
  "http://localhost:8000/api/votes"
# Should return empty [] or only User B's votes

# 3. Verify in Supabase SQL Editor:
SELECT * FROM votes;
# Should show votes for both users (RLS applies only for API requests)
```

**If RLS is NOT working**:
- [ ] RLS is enabled: `ALTER TABLE votes ENABLE ROW LEVEL SECURITY;`
- [ ] Policy exists and is correct (check `SELECT * FROM pg_policies;`)
- [ ] Type casting is correct: `(auth.jwt() ->> 'sub')::uuid` or `::text`
- [ ] Supabase third-party Auth has Auth0 issuer configured

---

## 🚀 Phase 7: Create Backend API Routes

For each table in Supabase you want to expose to the frontend, create a backend API route.

### 7.1 Pattern for GET (Read)

```python
# backend/app/main.py
from app.auth import requires_auth, get_bearer_token
from app.supabase_rls import create_user_client

@app.route("/api/table-name", methods=["GET"])
@requires_auth
def get_table():
    """Get all records for the current user (RLS filters automatically)."""
    token = get_bearer_token()
    supabase = create_user_client(token)
    
    response = supabase.table("table_name").select("*").execute()
    return jsonify(response.data)
```

### 7.2 Pattern for POST (Write)

```python
@app.route("/api/table-name", methods=["POST"])
@requires_auth
def create_record():
    """Create a new record (associated with current user)."""
    user_id = get_current_user()["sub"]
    token = get_bearer_token()
    data = request.get_json()
    
    supabase = create_user_client(token)
    
    # Always include user_id - RLS validates it matches JWT
    response = supabase.table("table_name").insert({
        "user_id": user_id,
        **data  # Other fields from request
    }).execute()
    
    return jsonify(response.data), 201
```

### 7.3 Pattern for PUT (Update)

```python
@app.route("/api/table-name/<int:id>", methods=["PUT"])
@requires_auth
def update_record(id):
    """Update a record (RLS ensures it belongs to current user)."""
    token = get_bearer_token()
    data = request.get_json()
    
    supabase = create_user_client(token)
    
    # RLS policy will validate the record belongs to this user
    response = supabase.table("table_name").update(data).eq("id", id).execute()
    return jsonify(response.data)
```

### 7.4 Pattern for DELETE (Delete)

```python
@app.route("/api/table-name/<int:id>", methods=["DELETE"])
@requires_auth
def delete_record(id):
    """Delete a record (RLS ensures it belongs to current user)."""
    token = get_bearer_token()
    supabase = create_user_client(token)
    
    response = supabase.table("table_name").delete().eq("id", id).execute()
    return "", 204
```

**Key points**:
- ✅ Always use `@requires_auth` decorator
- ✅ Always get token: `token = get_bearer_token()`
- ✅ Always create client: `supabase = create_user_client(token)`
- ✅ Always include `user_id` when inserting
- ❌ Never use `create_service_client()` for API responses
- ❌ Never expose the service role key

---

## 📊 Phase 8: Verify Complete Setup

Run this final checklist:

- [ ] Frontend dependencies installed (`npm list @auth0/nextjs-auth0`)
- [ ] Backend dependencies installed (`pip list | grep python-jose && pip list | grep supabase`)
- [ ] `frontend/.env.local` configured with Auth0 credentials only
- [ ] `backend/.env` configured with Auth0 AND Supabase secrets
- [ ] `backend/.env` is in `.gitignore` (sensitive secrets)
- [ ] Auth0 Action created and **deployed**
- [ ] Auth0 Regular Web Application configured with callback URLs
- [ ] Supabase has Auth0 as third-party provider **enabled**
- [ ] Database tables have RLS **enabled**
- [ ] RLS policies created with correct column names and type casting
- [ ] Login flow tested ✅ (redirects work end-to-end)
- [ ] Backend `/search` endpoint returns 200 with valid token
- [ ] Supabase RLS policies filtering data correctly
- [ ] `validate-migration.sh` shows all ✅ checks

---

## 🆘 Troubleshooting

### ⚠️ CRITICAL: Frontend is NOT supposed to connect to Supabase directly

**Symptoms**:
- Frontend code calls `import { createClient } from "@supabase/supabase-js"`
- Browser tries to connect directly to Supabase
- CORS errors from Supabase
- File `lib/supabase.ts` is being imported

**Fix**:
- ❌ **REMOVE** any imports of `@supabase/supabase-js` from frontend
- ❌ **DELETE** any calls to `createClient()` from frontend
- ✅ **CALL** backend API routes instead: `fetch('/api/votes')`, `fetch('/api/bills')`
- ✅ Backend API routes handle Supabase using `create_user_client(token)`

**Why this is critical**:
- If frontend connects to Supabase, RLS only partially works (no JWT validation context)
- Supabase secrets could be accidentally exposed
- Frontend should be stateless - backend owns all data access

### 401 on Backend Routes

```bash
# Check 1: Is AUTH0_DOMAIN set?
echo $AUTH0_DOMAIN

# Check 2: Is the Auth0 Action deployed?
# Go to Auth0 Dashboard → Actions → Flows → Login
# Status should be "DEPLOYED" (red = deployed, gray = draft)

# Check 3: Does token include the "role" claim?
# Open jwt.io, paste your token, look for:
# {
#   "role": "authenticated",
#   ...
# }
```

### Supabase RLS Rejecting Queries

```sql
-- Check 1: Is RLS enabled?
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check 2: What policies exist?
SELECT * FROM pg_policies WHERE tablename = 'votes';

-- Check 3: What's the current JWT?
SELECT auth.jwt();

-- Check 4: Are types matching?
-- If user_id is UUID, use: (auth.jwt() ->> 'sub')::uuid
-- If user_id is TEXT, use: (auth.jwt() ->> 'sub')::text
```

### Token Refresh Failing

In server components, tokens can't be refreshed automatically. Use **Route Handlers** instead:

```typescript
// ❌ Server Component (won't work)
export default async function Page() {
  const { token } = await auth0.getAccessToken();  // May be stale
}

// ✅ Route Handler (works)
export async function GET(req: Request) {
  const { token } = await auth0.getAccessToken();  // Refreshes if needed
  return Response.json({ token });
}
```

---

## 📚 Additional Resources

- [Full Migration Guide](./AUTH0_SUPABASE_MIGRATION.md)
- [Quick Reference](./MIGRATION_QUICK_REFERENCE.md)
- [Auth0 Docs](https://auth0.com/docs)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT.io - Inspect Tokens](https://jwt.io)

---

## ✨ Success Criteria

You'll know the migration is successful when:

✅ Login redirects to Auth0 and returns successfully  
✅ Frontend does NOT import from `@supabase/supabase-js`  
✅ Backend API routes (e.g., `/api/votes`) work with valid token  
✅ Backend `/api/votes` returns 200 with your data (not 401)  
✅ Backend `/api/votes` from another user only shows their votes (RLS works)  
✅ Supabase RLS policies are enforcing user isolation  
✅ `validate-migration.sh` shows all ✅ checks  

---

**🎉 Congratulations! Your app is now using Auth0 + Supabase RLS with secure backend-only database access!**

