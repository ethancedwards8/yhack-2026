"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserState } from "../context/UserStateContext";
import type { User } from "@supabase/supabase-js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Navbar() {
  const supabase = createClient();
  const { state, isStateLoading } = useUserState();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const synced = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sync user to backend on first login
  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch(`${BACKEND_URL}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
      borderBottom: "1px solid #333",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <a href="/" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
          BillRank
        </a>
        {user && (
          <a href="/match" style={{ fontSize: "0.875rem", opacity: 0.75 }}>
            Find Match
          </a>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {user ? (
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted-text)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--card-border)",
            }}
            title="Your home state filters which bills appear in the deck."
          >
            State:{" "}
            <strong style={{ color: "var(--foreground)" }}>
              {isStateLoading ? "…" : state || "—"}
            </strong>
          </span>
        ) : null}
        {loading ? (
          <span style={{ fontSize: "0.875rem", opacity: 0.5 }}>...</span>
        ) : user ? (
          <>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.875rem",
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                display: "inline-block",
              }} />
              {user.user_metadata?.full_name || user.email}
            </span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: "0.875rem",
                opacity: 0.7,
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <a href="/login" style={{
            fontSize: "0.875rem",
            padding: "6px 14px",
            border: "1px solid #555",
            borderRadius: "6px",
          }}>
            Log in
          </a>
        )}
      </div>
    </nav>
  );
}
