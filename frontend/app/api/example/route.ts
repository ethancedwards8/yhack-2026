import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createServerSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/example
 *
 * A minimal example of a protected Route Handler that:
 *   1. Verifies the user is authenticated via Auth0.
 *   2. Creates a Supabase client carrying the user's Auth0 JWT.
 *   3. Queries Supabase — RLS policies restrict rows to the calling user.
 *
 * Duplicate this pattern for any backend function that needs to read from
 * or write to Supabase on behalf of an authenticated user.
 *
 * To test:
 *   curl http://localhost:3000/api/example   # → 401 if not logged in
 *   # Log in at /auth/login, then retry     # → 200 with user + db data
 */
export async function GET() {
  // ── 1. Auth guard ────────────────────────────────────────────────────────
  // getSession() reads the encrypted Auth0 session cookie. Returns null when
  // the user is not logged in (never throws for missing sessions).
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in at /auth/login." },
      { status: 401 }
    );
  }

  // ── 2. Authenticated Supabase client ─────────────────────────────────────
  // createServerSupabaseClient() calls auth0.getAccessToken() internally and
  // injects the JWT as `Authorization: Bearer <token>`. Supabase RLS policies
  // can then use (auth.jwt() ->> 'sub') to scope rows to this user.
  const supabase = await createServerSupabaseClient();

  // ── 3. Example query ─────────────────────────────────────────────────────
  // Replace "your_table" with a real table name.
  // With RLS enabled, each user only sees their own rows — no extra WHERE
  // clause needed, Supabase enforces it via the JWT automatically.
  //
  // const { data, error } = await supabase
  //   .from("your_table")
  //   .select("*");
  //
  // if (error) {
  //   console.error("[/api/example] Supabase error:", error.message);
  //   return NextResponse.json({ error: "Database error." }, { status: 500 });
  // }

  // ── 4. Response ──────────────────────────────────────────────────────────
  return NextResponse.json({
    message: "Authenticated Supabase client ready.",
    user: {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name,
    },
    // data,   // ← uncomment once you have a real table to query
  });
}
