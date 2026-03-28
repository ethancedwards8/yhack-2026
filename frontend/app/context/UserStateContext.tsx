"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface UserStateContextType {
  state: string;
  setState: (state: string) => void;
}

const UserStateContext = createContext<UserStateContextType>({
  state: "VA",
  setState: () => {},
});

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [state, setStateLocal] = useState("VA");

  // Load saved state from backend on login
  useEffect(() => {
    if (!user) return;
    fetch("/auth/access-token")
      .then((r) => r.json())
      .then(({ token }) => {
        if (!token) return;
        return fetch(`${BACKEND_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
      })
      .then((profile) => {
        if (profile?.state) setStateLocal(profile.state);
      })
      .catch(() => {});
  }, [user]);

  const setState = (newState: string) => {
    setStateLocal(newState);
    fetch("/auth/access-token")
      .then((r) => r.json())
      .then(({ token }) => {
        if (!token) return;
        fetch(`${BACKEND_URL}/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: newState }),
        });
      })
      .catch(() => {});
  };

  return (
    <UserStateContext.Provider value={{ state, setState }}>
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  return useContext(UserStateContext);
}
