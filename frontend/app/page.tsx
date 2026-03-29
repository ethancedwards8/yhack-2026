"use client";

import { useUser } from "@auth0/nextjs-auth0";
import { useEffect, useState } from "react";
import { useUserState } from "./context/UserStateContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Bill {
  bill_id: number;
  bill_number: string;
  title: string;
  description: string;
  state: string;
  bill_elo: number;
  url: string;
}

export default function Page() {
  const { user, isLoading } = useUser();
  const { state } = useUserState();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/bills/?state=${state}`)
      .then((r) => r.json())
      .then((data) => {
        setBills(Array.isArray(data) ? data.slice(0, 10) : []);
      })
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [user, state]);

  if (isLoading) return <p>Loading...</p>;
  if (!user) return <h1>Log in to see bills</h1>;

  return (
    <div>
      <h1>{state} Bills</h1>
      {loading && <p>Loading bills...</p>}
      {bills.length === 0 && !loading && <p>No bills found for {state}</p>}
      <div style={{ display: "grid", gap: "16px" }}>
        {bills.map((bill) => (
          <div
            key={bill.bill_id}
            style={{
              border: "1px solid #ddd",
              padding: "16px",
              borderRadius: "8px",
            }}
          >
            <h3>
              <a href={bill.url} target="_blank" rel="noopener noreferrer">
                {bill.bill_number}: {bill.title}
              </a>
            </h3>
            <p style={{ margin: "8px 0", lineHeight: "1.5" }}>
              {bill.description}
            </p>
            <p style={{ opacity: 0.7, margin: "4px 0" }}>
              ELO: {bill.bill_elo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
