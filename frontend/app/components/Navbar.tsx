"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@auth0/nextjs-auth0";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Navbar() {
  const { user, isLoading } = useUser();
  const synced = useRef(false);

  // Sync user to Supabase via backend on first login detection
  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;

    fetch("/auth/access-token")
      .then((r) => r.json())
      .then(({ token }) => {
        if (!token) return;
        fetch(`${BACKEND_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .catch(() => {});
  }, [user]);

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
      borderBottom: "1px solid #333",
    }}>
      <a href="/" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
        BillRank
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {isLoading ? (
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
              {user.name || user.email}
            </span>
            <a href="/auth/logout" style={{
              fontSize: "0.875rem",
              opacity: 0.7,
              textDecoration: "underline",
            }}>
              Log out
            </a>
          </>
        ) : (
          <a href="/auth/login" style={{
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
