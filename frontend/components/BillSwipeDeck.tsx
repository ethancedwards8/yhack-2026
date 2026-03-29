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

type SwipeDirection = "left" | "right"

type BillSwipeDeckProps = {
  apiBaseUrl: string
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

export default function BillSwipeDeck({ apiBaseUrl }: BillSwipeDeckProps) {
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
  const nextCards = useMemo(
    () => bills.slice(currentIndex + 1, currentIndex + 3),
    [bills, currentIndex],
  )

  const loadBills = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${apiBaseUrl}/bills/?limit=${PAGE_SIZE}&offset=0&include_text=false`,
        { credentials: "include" },
      )
      if (!response.ok) {
        throw new Error(`Failed to load bills (${response.status})`)
      }
      const payload = await response.json()
      const parsed = parseBillSummaries(payload)
      setBills(parsed)
      setCurrentIndex(0)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load bills right now.",
      )
      setBills([])
      setCurrentIndex(0)
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  const performSwipe = useCallback(
    async (direction: SwipeDirection) => {
      if (!topBill || isAnimatingOut) {
        return
      }
      setIsAnimatingOut(true)
      const directionValue = direction === "right" ? 1 : -1
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
    [controls, isAnimatingOut, shouldReduceMotion, topBill],
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
      <section className="deckRoot">
        <h1>Swipe on bills</h1>
        <p className="subtleText">Loading bills...</p>
        <div className="skeletonCard" />
      </section>
    )
  }

  if (error) {
    return (
      <section className="deckRoot">
        <h1>Swipe on bills</h1>
        <p className="errorText">{error}</p>
        <button className="primaryButton" onClick={() => void loadBills()} type="button">
          Retry
        </button>
      </section>
    )
  }

  if (!topBill) {
    return (
      <section className="deckRoot">
        <h1>All caught up</h1>
        <p className="subtleText">You have reached the end of this bill stack.</p>
        <button className="primaryButton" onClick={() => void loadBills()} type="button">
          Reload stack
        </button>
      </section>
    )
  }

  return (
    <section className="deckRoot">
      <header className="deckHeader">
        <h1>Swipe on bills</h1>
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
          className="secondaryButton"
          disabled={isAnimatingOut}
          onClick={() => void performSwipe("left")}
          type="button"
        >
          Swipe left
        </button>
        <button
          className="primaryButton"
          disabled={isAnimatingOut}
          onClick={() => void performSwipe("right")}
          type="button"
        >
          Swipe right
        </button>
      </footer>

      <BillDetailModal
        apiBaseUrl={apiBaseUrl}
        billId={detailBillId}
        isOpen={detailBillId !== null}
        onClose={() => setDetailBillId(null)}
      />
    </section>
  )
}
