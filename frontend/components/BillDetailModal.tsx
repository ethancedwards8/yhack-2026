"use client"

import { useEffect, useState } from "react"

type BillDetailModalProps = {
  billId: number | null
  apiBaseUrl: string
  isOpen: boolean
  onClose: () => void
  /** Direct PDF document URL from our database (LegiScan text metadata). */
  storedPdfUrl?: string | null
}

type BillDetail = {
  bill_id?: number
  bill_number?: string
  title?: string
  description?: string
  state?: string
  status?: string
  status_date?: string
  url?: string
  texts?: Array<{ date?: string; type?: string }>
  sponsors?: Array<{ name?: string; party?: string }>
}

export default function BillDetailModal({
  billId,
  apiBaseUrl,
  isOpen,
  onClose,
  storedPdfUrl,
}: BillDetailModalProps) {
  const [detail, setDetail] = useState<BillDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || billId === null) {
      return
    }

    let isCancelled = false
    async function loadDetails() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${apiBaseUrl}/bill/${billId}`)
        if (!response.ok) {
          throw new Error(`Failed to load bill details (${response.status})`)
        }
        const payload = (await response.json()) as BillDetail
        if (!isCancelled) {
          setDetail(payload)
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setDetail(null)
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to fetch bill details.",
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDetails()
    return () => {
      isCancelled = true
    }
  }, [apiBaseUrl, billId, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setDetail(null)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <section
        className="modalCard"
        role="dialog"
        aria-modal="true"
        aria-label="Bill details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <h3>Bill details</h3>
          <button className="iconButton" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {isLoading ? <p>Loading full bill details...</p> : null}
        {error ? <p className="errorText">{error}</p> : null}

        {!isLoading && !error && detail ? (
          <div className="modalContent">
            <h4>{detail.title ?? "Untitled bill"}</h4>
            <p>
              {detail.state ?? "N/A"} • {detail.bill_number ?? "Unknown number"}
            </p>
            {detail.description ? <p>{detail.description}</p> : null}
            {detail.status ? <p>Status: {detail.status}</p> : null}
            {detail.status_date ? <p>Status date: {detail.status_date}</p> : null}
            {storedPdfUrl || detail.url ? (
              <p className="modalLinks">
                {storedPdfUrl ? (
                  <a href={storedPdfUrl} rel="noreferrer" target="_blank">
                    Open PDF
                  </a>
                ) : null}
                {storedPdfUrl && detail.url ? <span aria-hidden="true"> · </span> : null}
                {detail.url ? (
                  <a href={detail.url} rel="noreferrer" target="_blank">
                    {storedPdfUrl ? "View on LegiScan" : "Open source document"}
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
