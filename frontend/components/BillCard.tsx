"use client"

export type BillSummary = {
  bill_id: number
  bill_number?: string | null
  title?: string | null
  description?: string | null
  state?: string | null
  party?: string | null
  bill_elo?: number | null
  last_action?: string | null
  last_action_date?: string | null
  url?: string | null
}

type BillCardProps = {
  bill: BillSummary
  isTopCard: boolean
}

const SUMMARY_LIMIT = 220

function truncateText(value: string | null | undefined, maxLength: number): string {
  if (!value) {
    return "No summary available yet."
  }
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

export default function BillCard({ bill, isTopCard }: BillCardProps) {
  return (
    <article className={`billCard ${isTopCard ? "billCardTop" : "billCardBehind"}`}>
      <header className="billCardHeader">
        <p className="billMeta">
          {bill.state ?? "N/A"} • {bill.bill_number ?? `Bill #${bill.bill_id}`}
        </p>
        <h2 className="billTitle">{bill.title ?? "Untitled bill"}</h2>
      </header>

      <p className="billSummary">{truncateText(bill.description, SUMMARY_LIMIT)}</p>

      <footer className="billFooter">
        <span className="pill">{bill.party ?? "Unknown party"}</span>
        {typeof bill.bill_elo === "number" ? (
          <span className="pill">ELO {bill.bill_elo}</span>
        ) : null}
        {bill.last_action_date ? <span className="pill">{bill.last_action_date}</span> : null}
      </footer>
    </article>
  )
}
