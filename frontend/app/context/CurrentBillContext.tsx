"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface CurrentBillInfo {
  billId: number;
  title: string | null;
  state: string | null;
}

interface CurrentBillContextType {
  currentBill: CurrentBillInfo | null;
  setCurrentBill: (bill: CurrentBillInfo | null) => void;
}

const CurrentBillContext = createContext<CurrentBillContextType>({
  currentBill: null,
  setCurrentBill: () => {},
});

export function CurrentBillProvider({ children }: { children: React.ReactNode }) {
  const [currentBill, setCurrentBillRaw] = useState<CurrentBillInfo | null>(null);

  const setCurrentBill = useCallback((bill: CurrentBillInfo | null) => {
    setCurrentBillRaw(bill);
  }, []);

  return (
    <CurrentBillContext.Provider value={{ currentBill, setCurrentBill }}>
      {children}
    </CurrentBillContext.Provider>
  );
}

export function useCurrentBill() {
  return useContext(CurrentBillContext);
}
