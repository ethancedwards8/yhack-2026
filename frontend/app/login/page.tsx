"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const PDF_STATES = [
  // "AK","AL","AR","CO","CT","DC","FL","GA","HI","ID",
  // "IN","KS","KY","LA","MA","MD","ME","MN","MO","MS",
  // "MT","NC","ND","NE","NJ","NM","NV","OH","OK","OR",
  // "PA","RI","SD","TN","US","UT","VA","VT","WA","WI","WY",
 // "MA", "CT", "MD", "RI"
"CT",
];

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState(PDF_STATES[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, state },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (signUpError) { setError(signUpError.message); return; }
      window.location.href = "/";
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) { setError(signInError.message); return; }
      window.location.href = "/";
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 0,
    }}>
      {/* Card */}
      <div style={{
        border: "4px ridge #ffe300",
        background: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 8px, rgba(255,0,255,0.09) 8px 16px), #08081f",
        boxShadow: "0 0 0 3px #ff45ff inset, 0 12px 30px rgba(0,0,0,0.45)",
        padding: "28px 32px",
        width: "min(100%, 360px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        {/* Title bar */}
        <div style={{
          background: "linear-gradient(180deg, #0f2eff, #001da5 55%, #170073)",
          border: "2px outset #d7f9ff",
          padding: "6px 14px",
          marginBottom: 4,
        }}>
          <span style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: "1rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textShadow: "0 0 8px #00e1ff",
          }}>
            {mode === "login" ? "Sign in to HotBillsNearYou.com" : "Create an Account"}
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && (
            <>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={inputStyle}
              >
                {PDF_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />

          {error && (
            <p className="errorText" style={{ fontSize: "0.85rem" }}>{error}</p>
          )}

          <button type="submit" disabled={loading} className="primaryButton" style={{
            marginTop: 4,
            width: "100%",
            padding: "10px",
            fontSize: "0.95rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        {/* Mode toggle */}
        <div style={{ textAlign: "center", borderTop: "1px solid #2a2a6a", paddingTop: 12 }}>
          <span style={{ color: "#a0a0d0", fontSize: "0.85rem" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
            className="y2kActionLink"
            type="button"
            style={{ fontSize: "0.8rem" }}
          >
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: "0.95rem",
  border: "2px inset #d4d4d4",
  background: "#150161",
  color: "#ffffff",
  width: "100%",
  fontFamily: "inherit",
};
