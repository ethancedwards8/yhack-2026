#!/usr/bin/env python3
"""
legiscan_pdf_states.py
----------------------
Queries the LegiScan API for every U.S. state (+ DC and US Congress),
fetches the current session's master bill list, samples up to SAMPLE_SIZE
bills per state, and reports which states have any bill text in PDF format.

Usage:
    export LEGISCAN_API_KEY=your_key_here
    python legiscan_pdf_states.py

    # Or pass key directly:
    python legiscan_pdf_states.py --api-key YOUR_KEY

    # Adjust how many bills to sample per state (default: 10):
    python legiscan_pdf_states.py --sample 20
"""

import argparse
import os
import sys
import time
import requests
from collections import defaultdict

BASE_URL = "https://api.legiscan.com/"
PDF_MIME = "application/pdf"

# All state abbreviations LegiScan supports
ALL_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "US",
]


def api_get(api_key: str, params: dict, retries: int = 3) -> dict | None:
    """Make a GET request to the LegiScan API, return parsed JSON or None."""
    params["key"] = api_key
    for attempt in range(retries):
        try:
            resp = requests.get(BASE_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "OK":
                return data
            # API-level error
            msg = data.get("alert", {}).get("message", "unknown error")
            print(f"    [API ERROR] op={params.get('op')}: {msg}", file=sys.stderr)
            return None
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # exponential back-off
            else:
                print(f"    [HTTP ERROR] {e}", file=sys.stderr)
                return None
    return None


def get_current_session_id(api_key: str, state: str) -> int | None:
    """Return the most-recent (non-prior) session_id for a state."""
    data = api_get(api_key, {"op": "getSessionList", "state": state})
    if not data:
        return None
    sessions = data.get("sessions", [])
    # Prefer active sessions (prior=0, sine_die=0), fall back to most recent
    active = [s for s in sessions if not s.get("prior") and not s.get("sine_die")]
    pool = active if active else sessions
    if not pool:
        return None
    # Sort descending by year_start and pick the latest
    pool.sort(key=lambda s: s.get("year_start", 0), reverse=True)
    return pool[0]["session_id"]


def get_bill_ids(api_key: str, session_id: int, sample_size: int) -> list[int]:
    """Return up to sample_size bill_ids from a session's master list."""
    data = api_get(api_key, {"op": "getMasterListRaw", "id": session_id})
    if not data:
        return []
    master = data.get("masterlist", {})
    bill_ids = [v["bill_id"] for k, v in master.items() if k != "session"]
    return bill_ids[:sample_size]


PDF_URL_SUFFIXES = (".pdf", ".PDF")
LINK_FIELDS = ("url", "state_link", "alt_state_link")


def url_implies_pdf(url: str) -> bool:
    """Return True if a URL's path ends with a PDF extension."""
    # Strip query strings before checking the extension
    path = url.split("?")[0]
    return path.endswith(PDF_URL_SUFFIXES)


def get_pdf_details(api_key: str, bill_id: int) -> list[dict]:
    """
    For each text document in a bill that is PDF (by mime or URL),
    return a dict with:
      bill_number, bill_title, bill_url, doc_type, doc_date,
      mime, sources (set of field names where PDF was detected),
      url, state_link, alt_state_link
    Returns an empty list if no PDFs found or request fails.
    """
    data = api_get(api_key, {"op": "getBill", "id": bill_id})
    if not data:
        return []

    bill = data.get("bill", {})
    bill_number = bill.get("bill_number", "?")
    bill_title  = bill.get("title", "")
    bill_url    = bill.get("url", "")

    results = []
    for t in bill.get("texts", []):
        sources: set[str] = set()
        if t.get("mime") == PDF_MIME:
            sources.add("mime")
        for field in LINK_FIELDS:
            val = t.get(field, "")
            if val and url_implies_pdf(val):
                sources.add(field)

        if not sources:
            continue

        results.append({
            "bill_number": bill_number,
            "bill_title":  bill_title,
            "bill_url":    bill_url,
            "doc_type":    t.get("type", ""),
            "doc_date":    t.get("date", ""),
            "mime":        t.get("mime", ""),
            "sources":     sources,
            "url":         t.get("url", ""),
            "state_link":  t.get("state_link", ""),
            "alt_state_link": t.get("alt_state_link", ""),
        })

    return results


def main():
    parser = argparse.ArgumentParser(description="Find LegiScan states that use PDF bill text.")
    parser.add_argument("--api-key", default=os.environ.get("LEGISCAN_API_KEY"),
                        help="LegiScan API key (or set LEGISCAN_API_KEY env var)")
    parser.add_argument("--sample", type=int, default=10,
                        help="Number of bills to sample per state (default: 10)")
    parser.add_argument("--states", nargs="+", default=ALL_STATES,
                        help="Specific state abbreviations to check (default: all)")
    args = parser.parse_args()

    if not args.api_key:
        print("Error: provide --api-key or set LEGISCAN_API_KEY", file=sys.stderr)
        sys.exit(1)

    # state -> list of PDF text detail dicts
    pdf_states: dict[str, list[dict]] = {}
    non_pdf_states: list[str] = []
    error_states: list[str] = []

    print(f"Checking {len(args.states)} states, sampling up to {args.sample} bills each...\n")

    for state in args.states:
        print(f"[{state}] Fetching current session...", end=" ", flush=True)

        session_id = get_current_session_id(args.api_key, state)
        if session_id is None:
            print("no session found.")
            error_states.append(state)
            continue

        bill_ids = get_bill_ids(args.api_key, session_id, args.sample)
        if not bill_ids:
            print("no bills found.")
            error_states.append(state)
            continue

        print(f"session {session_id}, sampling {len(bill_ids)} bills...", end=" ", flush=True)

        all_details: list[dict] = []
        for bill_id in bill_ids:
            all_details.extend(get_pdf_details(args.api_key, bill_id))
            time.sleep(0.1)  # be polite to the API

        has_pdf = bool(all_details)
        print(f"{'PDF ✓' if has_pdf else 'no PDF'}"
              + (f" ({len(all_details)} PDF text doc(s))" if has_pdf else ""))

        if has_pdf:
            pdf_states[state] = all_details
        else:
            non_pdf_states.append(state)

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"STATES THAT USE PDF ({len(pdf_states)}/{len(args.states)}):")
    print("=" * 60)

    source_counts: dict[str, list[str]] = defaultdict(list)

    for state in sorted(pdf_states):
        details = pdf_states[state]
        all_sources: set[str] = set()
        for d in details:
            all_sources.update(d["sources"])
        for src in all_sources:
            source_counts[src].append(state)

        print(f"\n  {state}  (via: {', '.join(sorted(all_sources))})")
        print(f"  {'-' * 56}")

        # Print one row per PDF text document found
        for d in details:
            src_label = ", ".join(sorted(d["sources"]))
            date_str  = f" [{d['doc_date']}]" if d["doc_date"] else ""
            title_str = d["bill_title"][:60] + "…" if len(d["bill_title"]) > 60 else d["bill_title"]
            print(f"    Bill:     {d['bill_number']} — {title_str}")
            print(f"    Text:     {d['doc_type']}{date_str}  (mime: {d['mime'] or 'not set'})")
            print(f"    Detected: {src_label}")
            if d["bill_url"]:
                print(f"    LegiScan: {d['bill_url']}")
            if d["url"] and d["url"] != d["bill_url"]:
                print(f"    Text URL: {d['url']}")
            if d["state_link"]:
                print(f"    State:    {d['state_link']}")
            if d["alt_state_link"]:
                print(f"    Alt:      {d['alt_state_link']}")
            print()

    if non_pdf_states:
        print(f"STATES WITH NO PDF FOUND IN SAMPLE ({len(non_pdf_states)}):")
        print(f"  {', '.join(sorted(non_pdf_states))}\n")

    if error_states:
        print(f"STATES WITH ERRORS / NO DATA ({len(error_states)}):")
        print(f"  {', '.join(sorted(error_states))}\n")

    print("PDF DETECTION SOURCE BREAKDOWN:")
    for src, states in sorted(source_counts.items()):
        print(f"  {src}: {len(states)} states — {', '.join(sorted(states))}")

    print("\nNote: results reflect a sample of bills; a state may use multiple")
    print("formats. 'alt_state_link'/'state_link' detections mean PDF is only")
    print("available on the state's own site, not via the LegiScan mime field.")


if __name__ == "__main__":
    main()
