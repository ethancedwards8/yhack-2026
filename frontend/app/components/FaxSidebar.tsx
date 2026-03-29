"use client";

import { useState } from "react";
import { useCurrentBill } from "@/app/context/CurrentBillContext";
import { useUserState } from "@/app/context/UserStateContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type FaxResult = {
  name: string;
  fax: string;
  status_code?: number;
  response?: unknown;
  error?: string;
};

export default function FaxSidebar() {
  const { currentBill } = useCurrentBill();
  const { state } = useUserState();
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<FaxResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!currentBill && !!state && reason.trim().length > 0 && !isSending;

  async function handleSend() {
    if (!canSend || !currentBill) return;

    setIsSending(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`${BACKEND_URL}/fax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill_id: currentBill.billId,
          state,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      const data: FaxResult[] = await res.json();
      setResults(data);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="faxSidebar">
      <h2 className="faxSidebarTitle">Fax Your Senator</h2>

      {currentBill ? (
        <p className="faxSidebarBill">
          RE: <strong>{currentBill.title ?? `Bill #${currentBill.billId}`}</strong>
        </p>
      ) : (
        <p className="faxSidebarHint">Swipe to a bill to send a fax.</p>
      )}

      <label className="faxSidebarLabel" htmlFor="fax-reason">
        Your reason
      </label>
      <textarea
        id="fax-reason"
        className="faxSidebarTextarea"
        placeholder="Why do you oppose or support this bill?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        disabled={!currentBill || isSending}
      />

      <button
        type="button"
        className="primaryButton faxSidebarSendBtn"
        disabled={!canSend}
        onClick={handleSend}
      >
        {isSending ? "Sending..." : "Send Fax"}
      </button>

      {error && <p className="faxSidebarError">{error}</p>}

      {results && results.length > 0 && (
        <div className="faxSidebarResults">
          <p className="faxSidebarResultsTitle">Faxes sent:</p>
          <ul>
            {results.map((r, i) => (
              <li key={i} className="faxSidebarResultItem">
                <span>{r.name}</span>
                {r.error ? (
                  <span className="faxSidebarError">{r.error}</span>
                ) : (
                  <span className="faxSidebarSuccess">Sent</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
