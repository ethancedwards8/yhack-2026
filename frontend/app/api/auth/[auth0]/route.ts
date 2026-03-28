import { handleAuth } from '@auth0/nextjs-auth0';

/**
 * Auth0 Dynamic Route Handler
 *
 * This route handles Auth0 credentials and session management.
 * It automatically provides the following endpoints:
 *
 * - GET  /api/auth/login       → Redirect to Auth0 login
 * - GET  /api/auth/logout      → Clear session and redirect
 * - GET  /api/auth/callback    → Auth0 callback (handles authorization code)
 * - GET  /api/auth/me          → Get current user info
 */
export const GET = handleAuth();
