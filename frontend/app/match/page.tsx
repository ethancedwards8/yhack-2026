"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

type MatchedUser = {
  user_id: string
  name: string | null
  email: string | null
  bias: number
  avatar_url: string | null
}

function biasLabel(bias: number): string {
  if (bias < 0.2) return "Strong Democrat"
  if (bias < 0.4) return "Leaning Democrat"
  if (bias < 0.6) return "Independent"
  if (bias < 0.8) return "Leaning Republican"
  return "Strong Republican"
}

function biasColor(bias: number): string {
  if (bias < 0.4) return "#3b82f6"
  if (bias < 0.6) return "#a855f7"
  return "#ef4444"
}

export default function MatchPage() {
  const [match, setMatch] = useState<MatchedUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function findMatch() {
    setLoading(true)
    setError(null)
    setMatch(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setError("You must be logged in to find a match.")
        return
      }

      const userId = session.user.id

      // Get matches (sorted by closeness client-side)
      const matchRes = await fetch(`${API_BASE_URL}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, take: 10 }),
      })

      if (!matchRes.ok) {
        const body = await matchRes.json().catch(() => ({}))
        throw new Error(body.error ?? `Match request failed (${matchRes.status})`)
      }

      const { matches } = await matchRes.json() as { matches: { user_id: string; bias: number }[] }

      if (!matches || matches.length === 0) {
        setError("No matches found yet — swipe on more bills to improve your profile!")
        return
      }

      // Get own bias to find closest match
      const meRes = await fetch(`${API_BASE_URL}/user/${userId}`)
      const me = meRes.ok ? await meRes.json() : null
      const myBias: number = me?.bias ?? 0.5

      // Pick closest bias match
      const best = matches.reduce((a, b) =>
        Math.abs(a.bias - myBias) <= Math.abs(b.bias - myBias) ? a : b
      )

      // Fetch full profile for the best match
      const userRes = await fetch(`${API_BASE_URL}/user/${best.user_id}`)
      if (!userRes.ok) throw new Error("Could not load matched user profile.")
      const matchedUser: MatchedUser = await userRes.json()

      setMatch(matchedUser)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>
        Find Your Match
      </h1>
      <p style={{ color: "var(--muted-text)", marginBottom: 32 }}>
        We&apos;ll find someone whose political views align most closely with yours based on how you&apos;ve both voted on bills.
      </p>

      <button
        onClick={findMatch}
        disabled={loading}
        style={{
          padding: "12px 32px",
          fontSize: "1rem",
          fontWeight: 600,
          borderRadius: 10,
          border: "none",
          background: loading ? "#444" : "var(--foreground)",
          color: loading ? "#888" : "var(--background)",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Searching…" : "Find My Match"}
      </button>

      {error && (
        <p style={{ color: "#f87171", marginTop: 24 }}>{error}</p>
      )}

      {match && (
        <div
          style={{
            marginTop: 40,
            padding: "28px 24px",
            borderRadius: 16,
            border: "1px solid var(--card-border)",
            background: "var(--card-bg)",
            textAlign: "left",
          }}
        >
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-text)", marginBottom: 12 }}>
            Your closest match
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: biasColor(match.bias),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {match.avatar_url ? (
                <img
                  src={match.avatar_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (match.name || match.email || "?")[0].toUpperCase()
              )}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: "1.05rem", margin: 0 }}>
                {match.name || "Anonymous"}
              </p>
              {match.email && (
                <p style={{ fontSize: "0.8rem", color: "var(--muted-text)", margin: "2px 0 0" }}>
                  {match.email}
                </p>
              )}
            </div>
          </div>

          {/* Bias bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted-text)", marginBottom: 6 }}>
              <span>Democrat</span>
              <span>Republican</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#333", position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${match.bias * 100}%`,
                  background: `linear-gradient(to right, #3b82f6, ${biasColor(match.bias)})`,
                  borderRadius: 4,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <p style={{ textAlign: "center", fontSize: "0.8rem", marginTop: 8, color: biasColor(match.bias), fontWeight: 600 }}>
              {biasLabel(match.bias)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
