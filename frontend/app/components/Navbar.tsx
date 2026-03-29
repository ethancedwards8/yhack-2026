"use client";

import Image from "next/image";
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
    <header className="portalHeader" style={{ background: "transparent" }}>
      <nav className="y2kNav" style={{ background: "transparent" }}>
        <div
          className="y2kHeroWrap"
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "1rem", width: "100%" }}
        >
          <div
            className="y2kCenterHotbillsWrap"
            style={{ background: "transparent", border: "none", flex: "0 0 220px" }}
          >
            <Image
              src="/images/hotbills.png"
              alt="HotBills logo"
              width={920}
              height={349}
              className="y2kCenterHotbillsImage"
              style={{ background: "transparent", border: "none", width: "90%", height: "auto" }}
              priority
            />
          </div>
          <div className="y2kLonelyReposWrap" style={{ flex: 0.3, minWidth: 0 }}>
            <Image
              src="/images/lonelyrepos.png"
              alt="Lonely repos banner"
              width={700}
              height={242}
              className="y2kLonelyReposImage"
              style={{ width: "55%", height: "auto" }}
              priority
            />
          </div>
        </div>

        <div className="y2kNavRight">
          {loading ? (
            <span className="y2kGhostText">...</span>
          ) : user ? (
            <div className="y2kUserStack">
              {state ? <span className="y2kStateBadge">State: {state}</span> : null}
              <span className="y2kUserMeta">
                User: {user.user_metadata?.full_name || "Authenticated user"}
              </span>
              <span className="y2kUserMeta">Email: {user.email}</span>
              <a href="/match" className="y2kActionLink">Find Match</a>
              <a href="/votes" className="y2kActionLink">My Votes</a>
              <button onClick={handleLogout} className="y2kActionLink" type="button">
                Log out
              </button>
            </div>
          ) : (
            <a href="/login" className="y2kActionLink">
              Log in
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
