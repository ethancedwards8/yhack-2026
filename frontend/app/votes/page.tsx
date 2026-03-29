"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

type VoteRecord = {
  bill_id: number
  agree: number
  voted_at: string | null
  title: string | null
  description: string | null
  state: string | null
  party: string | null
  bill_elo: number | null
  pdf_url: string | null
}

function partyColor(party: string | null): string {
  if (party === "Democratic") return "#3b82f6"
  if (party === "Republican") return "#ef4444"
  return "#a855f7"
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function VotesPage() {
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "agreed" | "disagreed">("all")

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError("You must be logged in to view your votes.")
          return
        }
        const res = await fetch(`${API_BASE_URL}/me/votes`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error(`Failed to load votes (${res.status})`)
        setVotes(await res.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filtered = votes.filter((v) => {
    if (filter === "agreed") return v.agree === 1
    if (filter === "disagreed") return v.agree === 0
    return true
  })

  const agreedCount = votes.filter((v) => v.agree === 1).length
  const disagreedCount = votes.filter((v) => v.agree === 0).length

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", color: "var(--muted-text)" }}>
        Loading your votes…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", color: "#f87171" }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 4 }}>My Votes</h1>
      <p style={{ color: "var(--muted-text)", marginBottom: 24 }}>
        {votes.length} bill{votes.length !== 1 ? "s" : ""} swiped —{" "}
        <span style={{ color: "#4ade80" }}>{agreedCount} agreed</span>,{" "}
        <span style={{ color: "#f87171" }}>{disagreedCount} disagreed</span>
      </p>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["all", "agreed", "disagreed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid var(--card-border)",
              background: filter === f ? "var(--foreground)" : "transparent",
              color: filter === f ? "var(--background)" : "var(--foreground)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "var(--muted-text)", textAlign: "center", marginTop: 48 }}>
          No votes to show here yet.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((vote) => (
          <div
            key={vote.bill_id}
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid var(--card-border)",
              background: "var(--card-bg)",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            {/* Vote indicator */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: vote.agree === 1 ? "#166534" : "#7f1d1d",
                border: `2px solid ${vote.agree === 1 ? "#4ade80" : "#f87171"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {vote.agree === 1 ? "✓" : "✗"}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {vote.party && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: partyColor(vote.party) + "22",
                      color: partyColor(vote.party),
                      border: `1px solid ${partyColor(vote.party)}44`,
                    }}
                  >
                    {vote.party}
                  </span>
                )}
                {vote.state && (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted-text)" }}>{vote.state}</span>
                )}
                {vote.voted_at && (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted-text)", marginLeft: "auto" }}>
                    {formatDate(vote.voted_at)}
                  </span>
                )}
              </div>

              <p style={{ fontWeight: 600, margin: "0 0 4px", lineHeight: 1.3, fontSize: "0.95rem" }}>
                {vote.title ?? `Bill #${vote.bill_id}`}
              </p>

              {vote.description && (
                <p style={{ fontSize: "0.8rem", color: "var(--muted-text)", margin: 0, lineHeight: 1.5 }}>
                  {vote.description}
                </p>
              )}

              {vote.pdf_url && (
                <a
                  href={vote.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.75rem", color: "var(--muted-text)", marginTop: 8, display: "inline-block" }}
                >
                  View PDF →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
