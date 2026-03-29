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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch(`${BACKEND_URL}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((profile) => {
          if (profile?.state) setState(profile.state);
        })
        .catch(() => {});
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
