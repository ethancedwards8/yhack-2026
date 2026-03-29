"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface UserStateContextType {
  state: string;
}

const UserStateContext = createContext<UserStateContextType>({
  state: "",
});

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [state, setState] = useState("");

  useEffect(() => {
    console.log("[UserStateContext] mounting, fetching session...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[UserStateContext] session:", session ? `uid=${session.user.id}` : "null");
      if (!session?.access_token) {
        console.warn("[UserStateContext] no access token — user not logged in");
        return;
      }
      console.log("[UserStateContext] fetching GET /me from", BACKEND_URL);
      fetch(`${BACKEND_URL}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => {
          console.log("[UserStateContext] /me status:", r.status);
          return r.json();
        })
        .then((profile) => {
          console.log("[UserStateContext] /me profile:", profile);
          if (profile?.state) {
            console.log("[UserStateContext] setting state to:", profile.state);
            setState(profile.state);
          } else {
            console.warn("[UserStateContext] profile has no state field:", profile);
          }
        })
        .catch((err) => {
          console.error("[UserStateContext] /me fetch error:", err);
        });
    });
  }, []);

  return (
    <UserStateContext.Provider value={{ state }}>
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  return useContext(UserStateContext);
}
