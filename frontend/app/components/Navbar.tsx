"use client";

import { useUserState } from "../context/UserStateContext";

const PDF_STATES = [
  "AK","AL","AR","CO","CT","DC","FL","GA","HI","ID",
  "IN","KS","KY","LA","MA","MD","ME","MN","MO","MS",
  "MT","NC","ND","NE","NJ","NM","NV","OH","OK","OR",
  "PA","RI","SD","TN","US","UT","VA","VT","WA","WI","WY",
];

export default function Navbar() {
  const { state, setState } = useUserState();

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
      borderBottom: "1px solid #333",
    }}>
      <a href="/" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
        BillRank
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={{
            fontSize: "0.875rem",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #555",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {PDF_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </nav>
  );
}
