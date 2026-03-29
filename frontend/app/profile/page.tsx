"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

export default function ProfilePage() {
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile on mount
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || !session.user) {
        setLoading(false)
        return
      }
      setUserId(session.user.id)
      setEmail(session.user.email ?? "")

      try {
        const res = await fetch(`${BACKEND_URL}/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const profile = await res.json()
          setName(profile.name ?? "")
          setAvatarUrl(profile.avatar_url ?? null)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")

      const res = await fetch(`${BACKEND_URL}/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setMessage({ text: "Profile updated!", error: false })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Failed to save", error: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    setMessage(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile`,
      })
      if (error) throw error
      setResetSent(true)
      setMessage({ text: "Password reset email sent! Check your inbox.", error: false })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Failed to send reset email", error: true })
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploading(true)
    setMessage(null)

    try {
      const ext = file.name.split(".").pop() ?? "jpg"
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("avatars").getPublicUrl(path)
      const publicUrl = data.publicUrl + `?t=${Date.now()}`

      // Save to backend
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch(`${BACKEND_URL}/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ avatar_url: publicUrl }),
        })
      }

      setAvatarUrl(publicUrl)
      setMessage({ text: "Avatar updated!", error: false })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Upload failed", error: true })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", color: "var(--muted-text)" }}>
        Loading profile...
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <p>You must be logged in to view your profile.</p>
        <a href="/login" style={{ color: "#2563eb" }}>Log in</a>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 32 }}>Profile</h1>

      {/* Avatar */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "3px solid var(--card-border)",
            position: "relative",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "2.5rem", fontWeight: 700, color: "#888" }}>
              {(name || email || "?")[0].toUpperCase()}
            </span>
          )}
          {uploading && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "0.75rem",
            }}>
              Uploading...
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            marginTop: 10,
            fontSize: "0.8rem",
            background: "none",
            border: "none",
            color: "#2563eb",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {uploading ? "Uploading..." : "Change avatar"}
        </button>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted-text)", marginBottom: 6 }}>
          Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: "1rem",
            border: "1px solid #555",
            borderRadius: 8,
            background: "transparent",
            color: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Email (read-only) */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted-text)", marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: "1rem",
            border: "1px solid #444",
            borderRadius: 8,
            background: "#1a1a1a",
            color: "#888",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: "1rem",
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          background: saving ? "#444" : "#2563eb",
          color: "#fff",
          cursor: saving ? "not-allowed" : "pointer",
          marginBottom: 16,
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {/* Password reset */}
      <div style={{
        padding: "16px 20px",
        borderRadius: 12,
        border: "1px solid var(--card-border)",
        background: "var(--card-bg)",
        marginBottom: 16,
      }}>
        <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 8px" }}>Password</p>
        <p style={{ fontSize: "0.8rem", color: "var(--muted-text)", margin: "0 0 12px" }}>
          We&apos;ll send a password reset link to {email}.
        </p>
        <button
          onClick={handleResetPassword}
          disabled={resetSent}
          style={{
            padding: "8px 20px",
            fontSize: "0.85rem",
            border: "1px solid #555",
            borderRadius: 8,
            background: "transparent",
            color: resetSent ? "#888" : "inherit",
            cursor: resetSent ? "not-allowed" : "pointer",
          }}
        >
          {resetSent ? "Email sent" : "Reset Password"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <p style={{
          textAlign: "center",
          fontSize: "0.85rem",
          marginTop: 12,
          color: message.error ? "#f87171" : "#4ade80",
        }}>
          {message.text}
        </p>
      )}
    </div>
  )
}
