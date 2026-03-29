"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const BACKEND_URL = "https://api.hotbillsnearyou.com"

export default function ProfilePage() {
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bias, setBias] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
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
          if (profile.bias != null) setBias(parseFloat(profile.bias))
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

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords don't match.", error: true })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", error: true })
      return
    }
    setPasswordSaving(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword("")
      setConfirmPassword("")
      setMessage({ text: "Password updated!", error: false })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Failed to update password", error: true })
    } finally {
      setPasswordSaving(false)
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
      <div className="profileStatus profileStatusMuted">
        Loading profile...
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="profileStatus">
        <p>You must be logged in to view your profile.</p>
        <a href="/login" className="y2kActionLink">Log in</a>
      </div>
    )
  }

  return (
    <div className="profilePage">
      <h1 className="profileTitle">Profile</h1>

      <div className="profilePanel">
        <div className="profileAvatarSection">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="profileAvatarBox"
            type="button"
          >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="profileAvatarImage"
            />
          ) : (
            <span className="profileAvatarInitial">
              {(name || email || "?")[0].toUpperCase()}
            </span>
          )}
          {uploading && (
            <div className="profileAvatarOverlay">
              Uploading...
            </div>
          )}
          </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="profileFileInput"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="profileLinkButton"
          type="button"
        >
          {uploading ? "Uploading..." : "Change avatar"}
        </button>
      </div>

      <div className="profileField">
        <label className="profileLabel">
          Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="profileInput"
        />
      </div>

      <div className="profileField">
        <label className="profileLabel">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="profileInput profileInputDisabled"
        />
      </div>

      {bias != null && (
        <div className="profileField">
          <label className="profileLabel">Political Stance</label>
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#a0a0d0", marginBottom: 6 }}>
              <span>Left</span>
              <span>Right</span>
            </div>
            <div style={{ height: 10, border: "2px inset #d4d4d4", background: "#150161", position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: `${bias * 100}%`,
                background: bias < 0.4 ? "linear-gradient(to right, #73ff00, #9eff01)" : bias < 0.6 ? "linear-gradient(to right, #73ff00, #ff4400)" : "linear-gradient(to right, #73ff00, #ef4444)",
                transition: "width 0.6s ease",
              }} />
            </div>
            <p style={{ textAlign: "center", fontSize: "0.8rem", marginTop: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
              color: bias < 0.4 ? "#9eff01" : bias < 0.6 ? "#ff4400" : "#ef4444" }}>
              {bias < 0.2 ? "Strong Democrat" : bias < 0.4 ? "Leaning Democrat" : bias < 0.6 ? "Neutral" : bias < 0.8 ? "Leaning Republican" : "Strong Republican"}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="profilePrimaryButton"
        type="button"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <div className="profilePasswordCard">
        <p className="profileSectionTitle">Change Password</p>
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="profileInput"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="profileInput"
        />
        <button
          onClick={handleChangePassword}
          disabled={passwordSaving || !newPassword}
          className="profileSecondaryButton"
          type="button"
        >
          {passwordSaving ? "Updating..." : "Update Password"}
        </button>
      </div>

      {message && (
        <p className={`profileMessage ${message.error ? "profileMessageError" : "profileMessageSuccess"}`}>
          {message.text}
        </p>
      )}
      </div>
    </div>
  )
}
