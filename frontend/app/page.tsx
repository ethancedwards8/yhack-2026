"use client";

import { useUser } from "@auth0/nextjs-auth0";
import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Bill {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  bill_elo: number;
}

export default function Page() {
  const { user, isLoading } = useUser();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/bills/?state=VA`)
      .then((r) => r.json())
      .then((data) => {
        setBills(Array.isArray(data) ? data.slice(0, 10) : []);
      })
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) return <p>Loading...</p>;
  if (!user) return <h1>Log in to see bills</h1>;

  return (
    <div>
      <h1>VA Bills</h1>
      {loading && <p>Loading bills...</p>}
      {bills.length === 0 && !loading && <p>No bills found</p>}
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
            <h3>{bill.bill_number}: {bill.title}</h3>
            <p style={{ opacity: 0.7, margin: "4px 0" }}>
              ELO: {bill.bill_elo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
