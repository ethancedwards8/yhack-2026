"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const PDF_STATES = [
  "AK","AL","AR","CO","CT","DC","FL","GA","HI","ID",
  "IN","KS","KY","LA","MA","MD","ME","MN","MO","MS",
  "MT","NC","ND","NE","NJ","NM","NV","OH","OK","OR",
  "PA","RI","SD","TN","US","UT","VA","VT","WA","WI","WY",
];

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("VA");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, state },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setCheckEmail(true);
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      window.location.href = "/";
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (checkEmail) {
    return (
      <div style={containerStyle}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Check your email</h1>
        <p style={{ color: "var(--muted-text)", textAlign: "center", maxWidth: 360 }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>
        {mode === "login" ? "Sign in to BillRank" : "Create an account"}
      </h1>

      <button onClick={handleGoogleLogin} style={oauthButtonStyle}>
        Sign in with Google
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: 320 }}>
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid #555" }} />
        <span style={{ fontSize: "0.8rem", color: "var(--muted-text)" }}>or</span>
        <hr style={{ flex: 1, border: "none", borderTop: "1px solid #555" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
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
        {error && <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>{error}</p>}
        <button type="submit" disabled={loading} style={submitButtonStyle}>
          {loading ? "..." : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p style={{ fontSize: "0.875rem", color: "var(--muted-text)" }}>
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "60vh",
  gap: 20,
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "1rem",
  border: "1px solid #555",
  borderRadius: "8px",
  background: "transparent",
  color: "inherit",
};

const oauthButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: "1rem",
  border: "1px solid #555",
  borderRadius: "8px",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  maxWidth: 320,
  color: "inherit",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "1rem",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};
