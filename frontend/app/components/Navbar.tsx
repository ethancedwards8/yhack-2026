"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HorizontalAdRail from "./HorizontalAdRail";
import { useUserState } from "../context/UserStateContext";
import type { User } from "@supabase/supabase-js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Navbar() {
  const supabase = createClient();
  const { state } = useUserState();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.access_token) {
        try {
          const res = await fetch(`${BACKEND_URL}/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const profile = await res.json();
            setDisplayName(profile.name || "");
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    }
    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.access_token) {
          try {
            const res = await fetch(`${BACKEND_URL}/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const profile = await res.json();
              setDisplayName(profile.name || "");
            }
          } catch { /* ignore */ }
        } else {
          setDisplayName("");
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="portalHeader" style={{ background: "transparent" }}>
      <nav className="y2kNav" style={{ background: "transparent" }}>
        <a href="/" className="y2kHeroWrap" style={{ textDecoration: "none" }}>
          <div className="y2kCenterHotbillsWrap">
            <Image
              src="/images/hotbills.png"
              alt="HotBills logo"
              width={920}
              height={349}
              className="y2kCenterHotbillsImage"
              priority
            />
          </div>
          <HorizontalAdRail
            images={[
              {
                src: "/images/lonelyrepos.png",
                alt: "Lonely repos banner",
                width: 700,
                height: 242,
              },
              {
                src: "/images/GSTACK.png",
                alt: "Gstack banner",
                width: 700,
                height: 242,
              },
            ]}
            cycleMs={10000}
          />
        </a>

        <div className="y2kNavRight">
          {loading ? (
            <span className="y2kGhostText">...</span>
          ) : user ? (
            <div className="y2kUserStack">
              {state ? <span className="y2kStateBadge">State: {state}</span> : null}
              <span className="y2kUserMeta">Email: {user.email}</span>
              <a href="/profile" className="y2kActionLink">Profile</a>
              <a href="/match" className="y2kActionLink">Find Match</a>
              <a href="/votes" className="y2kActionLink">My Votes</a>
              <button onClick={handleLogout} className="y2kActionLink" type="button">
                Log Out
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
