# Auth0 Login/Signup Setup

## Overview

The app now has a complete Auth0 authentication flow:

1. **Frontend Auth0 Login**: Click "Sign in with Auth0" to authenticate via Auth0's hosted login
2. **User Sync**: On login, the frontend calls `/api/user/sync` which:
   - Extracts user info from the Auth0 JWT token
   - Creates/updates the user record in Supabase's `users` table
3. **Display Name**: The frontend fetches the user's display name from the backend
   - Uses `/api/user/display-name` endpoint
   - This can be customized by updating the database record

## Files Created/Modified

### Frontend
- `proxy.ts` - Auth0 middleware configuration
- `app/components/LoginButton.tsx` - Login button
- `app/components/LogoutButton.tsx` - Logout button  
- `app/components/Profile.tsx` - Shows user profile with synced display name
- `app/page.tsx` - Main page with login/logout UI
- `app/layout.tsx` - Wrapped with Auth0Provider
- `app/api/user/sync/route.ts` - Proxy to backend sync endpoint
- `app/api/user/display-name/route.ts` - Proxy to backend display name endpoint

### Backend
- `app/main.py` - Added two new endpoints:
  - `POST /api/user/sync` - Syncs Auth0 user to database
  - `GET /api/user/display-name` - Returns user's display name

## Environment Variables

The frontend `.env.local` already has:
```
AUTH0_DOMAIN=dev-o6cb26yy5pj38z6l.us.auth0.com
AUTH0_CLIENT_ID=0VWRNlujHklqXBwfQXVPntuVieghUyqI
AUTH0_CLIENT_SECRET=VVThRFa7HZS7vRU7sL3D61koZ7gyIjIlj55HE-uk4xxMcP_LiB0xOmiKYVz9lB-P
AUTH0_SECRET=4ada3d4805939eafb2603819c3c4e76cf23262555d7705ab52571141d0d3be95
APP_BASE_URL=http://localhost:3000
```

The backend needs these in `.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
AUTH0_DOMAIN=dev-o6cb26yy5pj38z6l.us.auth0.com
LEGISCAN_API_KEY=3cde4350149f3f0ab82e7fcb342fe836
```

## How It Works

1. User clicks "Sign in with Auth0"
2. Auth0 redirects to their login page
3. On successful login, user is redirected to `http://localhost:3000`
4. Auth0Provider retrieves the session
5. Profile component calls `/api/user/sync` (frontend route handler)
6. Frontend route handler calls backend's `/api/user/sync` with Auth0 JWT
7. Backend creates/updates user in Supabase using service client (bypasses RLS)
8. Profile component then calls `/api/user/display-name` to get the stored name
9. Frontend displays the name from database instead of cached Auth0 info

## Next Steps

1. Start the backend:
   ```bash
   cd backend
   docker build -t yhack .
   docker run -p 8000:8000 -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... yhack
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Visit `http://localhost:3000`
4. Click "Sign in with Auth0"
5. Log in with your Auth0 test credentials
6. The user profile should appear with the synced display name

## Database Schema

The `users` table needs:
```sql
CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
```

RLS policy to sync on insert (optional, for automatic creation):
```sql
CREATE POLICY "Allow inserts for authenticated users" ON users 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
```
