"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL = "https://api.hotbillsnearyou.com";

interface UserStateContextType {
  state: string;
  /** True while fetching /me for the current session (or no session yet). */
  isStateLoading: boolean;
}

const UserStateContext = createContext<UserStateContextType>({
  state: "",
  isStateLoading: true,
});

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState("");
  const [isStateLoading, setIsStateLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadStateFromSession(accessToken: string | undefined) {
      if (!accessToken) {
        setState("");
        setIsStateLoading(false);
        return;
      }
      setIsStateLoading(true);
      try {
        const r = await fetch(`${BACKEND_URL}/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await r.json();
        setState(typeof profile?.state === "string" ? profile.state : "");
      } catch {
        setState("");
      } finally {
        setIsStateLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadStateFromSession(session?.access_token);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadStateFromSession(session?.access_token);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserStateContext.Provider value={{ state, isStateLoading }}>
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  return useContext(UserStateContext);
}
