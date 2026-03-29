"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const API_BASE_URL = "https://api.hotbillsnearyou.com"

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
  if (bias < 0.6) return "Neutral"
  if (bias < 0.8) return "Leaning Republican"
  return "Strong Republican"
}

function biasColor(bias: number): string {
  if (bias < 0.4) return "#9eff01"
  if (bias < 0.6) return "#ff4400"
  return "#ef4444"
}

function BiasBar({ bias }: { bias: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1f2d6b", marginBottom: 6 }}>
        <span>Left</span>
        <span>Right</span>
      </div>
      <div style={{ height: 10, border: "2px inset #d4d4d4", background: "#150161", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${bias * 100}%`,
          background: `linear-gradient(to right, #73ff00, ${biasColor(bias)})`,
          transition: "width 0.6s ease",
        }} />
      </div>
      <p style={{
        textAlign: "center", fontSize: "0.8rem", marginTop: 8,
        color: biasColor(bias), fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {biasLabel(bias)}
      </p>
    </div>
  )
}

export default function MatchPage() {
  const [match, setMatch] = useState<MatchedUser | null>(null)
  const [myBias, setMyBias] = useState<number | null>(null)
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

      const meRes = await fetch(`${API_BASE_URL}/user/${userId}`)
      const me = meRes.ok ? await meRes.json() : null
      const myBiasVal: number = me?.bias ?? 0.5
      setMyBias(myBiasVal)

      const best = matches.reduce((a, b) =>
        Math.abs(a.bias - myBiasVal) <= Math.abs(b.bias - myBiasVal) ? a : b
      )

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
    <div style={{ maxWidth: 480, margin: "32px auto", padding: "0 12px" }}>
      {/* Title bar */}
      <div style={{
        background: "linear-gradient(180deg, #0f2eff, #001da5 55%, #170073)",
        border: "2px outset #d7f9ff",
        padding: "6px 14px",
        marginBottom: 16,
      }}>
        <span style={{
          color: "#fff",
          fontWeight: 800,
          fontSize: "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          textShadow: "0 0 8px #00e1ff",
        }}>
          Find Your Match
        </span>
      </div>

      {/* Card */}
      <div style={{
        border: "4px ridge #ffe300",
        background: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 8px, rgba(255,0,255,0.09) 8px 16px), #08081f",
        boxShadow: "0 0 0 3px #ff45ff inset, 0 12px 30px rgba(0,0,0,0.45)",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <p style={{ color: "#a0a0d0", fontSize: "0.9rem", lineHeight: 1.5 }}>
          We&apos;ll find someone whose political views align most closely with yours based on how you&apos;ve both voted on bills.
        </p>

        <button
          onClick={findMatch}
          disabled={loading}
          className="primaryButton"
          style={{
            padding: "10px 28px",
            fontSize: "0.95rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            alignSelf: "flex-start",
          }}
        >
          {loading ? "Searching…" : "Find My Match"}
        </button>

        {error && (
          <p className="errorText" style={{ fontSize: "0.85rem" }}>{error}</p>
        )}

        {match && (
          <div style={{
            border: "3px ridge var(--card-border)",
            background: "var(--card-background)",
            boxShadow: "0 0 0 2px #00e1ff inset",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            {/* Title bar for result */}
            <div style={{
              background: "linear-gradient(180deg, #3f22d3, #150161)",
              border: "2px inset #d4d4d4",
              padding: "4px 10px",
            }}>
              <span style={{
                color: "#ffec42",
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}>
                Your Closest Match
              </span>
            </div>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 52, height: 52,
                border: "3px outset #f5f5f5",
                background: biasColor(match.bias),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.4rem", fontWeight: 800, color: "#fff",
                flexShrink: 0, overflow: "hidden",
              }}>
                {match.avatar_url ? (
                  <img src={match.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  (match.name || match.email || "?")[0].toUpperCase()
                )}
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: "1rem", margin: 0, color: "#111" }}>
                  {match.name || "Anonymous"}
                </p>
                {match.email && (
                  <p style={{ fontSize: "0.8rem", color: "#1f2d6b", margin: "2px 0 0", fontWeight: 600 }}>
                    {match.email}
                  </p>
                )}
              </div>
            </div>

            {/* Their stance */}
            <div>
              <p style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a0a0d0", marginBottom: 6 }}>
                Their Stance
              </p>
              <BiasBar bias={match.bias} />
            </div>

            {/* Your stance */}
            {myBias != null && (
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a0a0d0", marginBottom: 6 }}>
                  Your Stance
                </p>
                <BiasBar bias={myBias} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
