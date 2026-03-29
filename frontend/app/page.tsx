"use client"

import Image from "next/image"
import BillSwipeDeck from "@/components/BillSwipeDeck"
import { useUserState } from "./context/UserStateContext"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

export default function Page() {
  const { state, isStateLoading } = useUserState()

  if (!isStateLoading && !state) {
    return (
      <main className="appShell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32 }}>
        <Image
          src="/images/hotbills.png"
          alt="Hot Bills Near You"
          width={920}
          height={349}
          priority
          style={{ width: "min(600px, 90vw)", height: "auto" }}
        />
        <a
          href="/login"
          style={{
            padding: "12px 36px",
            fontSize: "1.1rem",
            fontWeight: 700,
            borderRadius: 10,
            background: "#e535ab",
            color: "#fff",
            textDecoration: "none",
            letterSpacing: "0.03em",
          }}
        >
          Get Started
        </a>
      </main>
    )
  }

  return (
    <main className="appShell">
      <BillSwipeDeck apiBaseUrl={API_BASE_URL} userState={state} />
    </main>
  )
}
