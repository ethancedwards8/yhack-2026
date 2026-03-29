"use client";

import { createContext, useContext, useState } from "react";

interface UserStateContextType {
  state: string;
  setState: (state: string) => void;
}

const UserStateContext = createContext<UserStateContextType>({
  state: "VA",
  setState: () => {},
});

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState("VA");

  return (
    <UserStateContext.Provider value={{ state, setState }}>
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  return useContext(UserStateContext);
}
