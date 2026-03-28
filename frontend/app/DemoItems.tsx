"use client";

import { useCallback, useEffect, useState } from "react";

type DemoItem = {
  id: string;
  body: string;
  created_at: string;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export function DemoItems() {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`${apiBase}/api/demo-items`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : `Request failed (${res.status})`,
      );
      setItems([]);
      return;
    }
    setItems(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/demo-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Request failed (${res.status})`,
        );
        return;
      }
      setBody("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginTop: "2rem", maxWidth: "36rem" }}>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>
        Demo items (Supabase via Flask)
      </h2>
      <form onSubmit={addItem} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="New item text"
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button type="submit" disabled={loading}>
          Add
        </button>
      </form>
      {error ? (
        <p style={{ color: "crimson", marginTop: "0.75rem" }}>{error}</p>
      ) : null}
      <ul style={{ marginTop: "1rem", paddingLeft: "1.25rem" }}>
        {items.map((it) => (
          <li key={it.id} style={{ marginBottom: "0.35rem" }}>
            <span style={{ opacity: 0.75, fontSize: "0.85rem" }}>
              {it.created_at}
            </span>
            {" — "}
            {it.body}
          </li>
        ))}
      </ul>
    </section>
  );
}
