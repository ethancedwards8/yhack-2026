"use client"

import BillSwipeDeck from "@/components/BillSwipeDeck"
import { useUserState } from "./context/UserStateContext"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

export default function Page() {
  const { state } = useUserState()

  return (
    <main className="appShell">
      <BillSwipeDeck apiBaseUrl={API_BASE_URL} userState={state} />
    </main>
  )
}
