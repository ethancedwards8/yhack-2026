"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion"

import BillCard, { type BillSummary } from "@/components/BillCard"
import BillDetailModal from "@/components/BillDetailModal"
import { createClient } from "@/lib/supabase/client"

type SwipeDirection = "left" | "right"

type BillSwipeDeckProps = {
  apiBaseUrl: string
  userState: string
}

const PAGE_SIZE = 30
const SWIPE_DISTANCE_THRESHOLD = 120
const SWIPE_VELOCITY_THRESHOLD = 700
const TAP_DISTANCE_THRESHOLD = 8

function parseBillSummaries(payload: unknown): BillSummary[] {
  if (!Array.isArray(payload)) {
    return []
  }
  return payload.filter((entry): entry is BillSummary => {
    if (typeof entry !== "object" || entry === null) {
      return false
    }
    const billId = (entry as { bill_id?: unknown }).bill_id
    return typeof billId === "number"
  })
}

async function castVote(apiBaseUrl: string, billId: number, userVote: 0 | 1) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return
  await fetch(`${apiBaseUrl}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ bill_id: billId, user_vote: userVote }),
  })
}

export default function BillSwipeDeck({ apiBaseUrl, userState }: BillSwipeDeckProps) {
  const shouldReduceMotion = useReducedMotion()
  const controls = useAnimationControls()
  const [bills, setBills] = useState<BillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const [detailBillId, setDetailBillId] = useState<number | null>(null)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const pointerMovedRef = useRef(false)

  const topBill = bills[currentIndex] ?? null
  const detailBill =
    detailBillId !== null ? bills.find((b) => b.bill_id === detailBillId) ?? null : null
  const nextCards = useMemo(
    () => bills.slice(currentIndex + 1, currentIndex + 3),
    [bills, currentIndex],
  )

  const loadBills = useCallback(async () => {
    console.log("[BillSwipeDeck] loadBills called, userState=", userState)
    setIsLoading(true)
    setError(null)
    try {
      const stateParam = userState ? `&state=${userState}` : ""
      const url = `${apiBaseUrl}/bills/?limit=${PAGE_SIZE}&offset=0&include_text=false${stateParam}`
      console.log("[BillSwipeDeck] fetching:", url)
      const response = await fetch(url, { credentials: "include" })
      console.log("[BillSwipeDeck] response status:", response.status)
      if (!response.ok) {
        throw new Error(`Failed to load bills (${response.status})`)
      }
      const payload = await response.json()
      console.log("[BillSwipeDeck] raw payload length:", Array.isArray(payload) ? payload.length : payload)
      const parsed = parseBillSummaries(payload)
      console.log("[BillSwipeDeck] parsed bills:", parsed.length)
      setBills(parsed)
      setCurrentIndex(0)
    } catch (loadError) {
      console.error("[BillSwipeDeck] load error:", loadError)
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load bills right now.",
      )
      setBills([])
      setCurrentIndex(0)
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, userState])

  useEffect(() => {
    console.log("[BillSwipeDeck] userState changed to:", userState)
    if (userState) loadBills()
    else console.warn("[BillSwipeDeck] userState is empty, not loading bills")
  }, [loadBills, userState])

  const performSwipe = useCallback(
    async (direction: SwipeDirection) => {
      if (!topBill || isAnimatingOut) {
        return
      }
      setIsAnimatingOut(true)
      const directionValue = direction === "right" ? 1 : -1
      // Fire vote in background — don't await so animation isn't blocked
      void castVote(apiBaseUrl, topBill.bill_id, direction === "right" ? 1 : 0)
      await controls.start({
        x: directionValue * 520,
        rotate: directionValue * 18,
        opacity: 0,
        transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.22 },
      })
      await controls.set({ x: 0, rotate: 0, opacity: 1 })
      setCurrentIndex((index) => index + 1)
      setIsAnimatingOut(false)
    },
    [apiBaseUrl, controls, isAnimatingOut, shouldReduceMotion, topBill],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!topBill || isAnimatingOut) {
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        void performSwipe("left")
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        void performSwipe("right")
      } else if (event.key === "Enter") {
        event.preventDefault()
        setDetailBillId(topBill.bill_id)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isAnimatingOut, performSwipe, topBill])

  if (isLoading) {
    return (
      <section className="deckRoot deckLight y2kDeckRoot">
        <h1 className="y2kDeckTitle">Swipe on bills</h1>
        <p className="subtleText">Loading bills...</p>
        <div className="skeletonCard" />
      </section>
    )
  }

  if (error) {
    return (
      <section className="deckRoot deckLight y2kDeckRoot">
        <h1 className="y2kDeckTitle">Swipe on bills</h1>
        <p className="errorText">{error}</p>
        <button className="primaryButton" onClick={() => void loadBills()} type="button">
          Retry
        </button>
      </section>
    )
  }

  if (!topBill) {
    return (
      <section className="deckRoot deckLight y2kDeckRoot">
        <h1 className="y2kDeckTitle">All caught up</h1>
        <p className="subtleText">You have reached the end of this bill stack.</p>
        <button className="primaryButton" onClick={() => void loadBills()} type="button">
          Reload stack
        </button>
      </section>
    )
  }

  return (
    <section className="deckRoot deckLight y2kDeckRoot">
      <header className="deckHeader">
        <h1 className="y2kDeckTitle">Swipe on bills</h1>
        <p className="subtleText">Tap a card to read more. Arrow keys also work.</p>
      </header>

      <div className="deckStage" aria-live="polite">
        {nextCards.map((bill, index) => (
          <div
            className="stackCard"
            key={bill.bill_id}
            style={{
              transform: `translateY(${(index + 1) * 10}px) scale(${1 - (index + 1) * 0.03})`,
            }}
          >
            <BillCard bill={bill} isTopCard={false} />
          </div>
        ))}

        <AnimatePresence>
          <motion.div
            className="topCardWrapper"
            key={topBill.bill_id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            animate={controls}
            whileTap={{ scale: 0.995 }}
            onPointerDown={(event) => {
              pointerDownRef.current = { x: event.clientX, y: event.clientY }
              pointerMovedRef.current = false
            }}
            onPointerMove={(event) => {
              if (!pointerDownRef.current) {
                return
              }
              const deltaX = event.clientX - pointerDownRef.current.x
              const deltaY = event.clientY - pointerDownRef.current.y
              if (Math.hypot(deltaX, deltaY) > TAP_DISTANCE_THRESHOLD) {
                pointerMovedRef.current = true
              }
            }}
            onPointerUp={() => {
              if (!pointerMovedRef.current && !isAnimatingOut) {
                setDetailBillId(topBill.bill_id)
              }
              pointerDownRef.current = null
            }}
            onDragEnd={(_, info) => {
              const absDistance = Math.abs(info.offset.x)
              const absVelocity = Math.abs(info.velocity.x)
              const shouldDismiss =
                absDistance > SWIPE_DISTANCE_THRESHOLD || absVelocity > SWIPE_VELOCITY_THRESHOLD
              if (shouldDismiss) {
                const direction = info.offset.x >= 0 ? "right" : "left"
                void performSwipe(direction)
              } else {
                void controls.start({
                  x: 0,
                  rotate: 0,
                  transition: shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 450, damping: 30 },
                })
              }
            }}
            style={{ touchAction: "pan-y" }}
          >
            <BillCard bill={topBill} isTopCard />
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="deckFooter">
        <button
          className="secondaryButton deckActionButton"
          type="button"
          disabled={isAnimatingOut}
          aria-label="Disagree"
          onClick={() => void performSwipe("left")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          className="primaryButton deckActionButton"
          type="button"
          disabled={isAnimatingOut}
          aria-label="Agree"
          onClick={() => void performSwipe("right")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </footer>

      <BillDetailModal
        apiBaseUrl={apiBaseUrl}
        billId={detailBillId}
        isOpen={detailBillId !== null}
        onClose={() => setDetailBillId(null)}
        storedPdfUrl={detailBill?.pdf_url ?? null}
      />
    </section>
  )
}
