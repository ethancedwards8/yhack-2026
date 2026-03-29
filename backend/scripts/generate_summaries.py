#!/usr/bin/env python3
"""
Generates 1-2 sentence summaries for bills using the Claude API
and updates the description column in the bills table.

Usage:
    cd backend
    uv run scripts/generate_summaries.py

Requires environment variables:
    SUPABASE_URL
    SUPABASE_KEY
    ANTHROPIC_API_KEY
"""

import os
import sys
import time

import anthropic
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

MODEL = "claude-haiku-4-5"
BATCH_DELAY = 0.5  # seconds between API calls to avoid rate limits


def generate_summary(client: anthropic.Anthropic, bill_text: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": (
                    "Summarize the following legislative bill in 1-2 sentences. "
                    "Be specific about what the bill does — include key provisions, "
                    "affected parties, and any notable requirements or changes. "
                    "Do not start with 'This bill' or 'The bill'.\n\n"
                    f"{bill_text[:8000]}"  # truncate to stay within token limits
                ),
            }
        ],
    )
    return response.content[0].text.strip()


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Fetch bills that have text but may need summaries updated
    result = (
        sb.table("bills")
        .select("bill_id, title, text")
        .not_.is_("text", "null")
        .neq("text", "")
        .execute()
    )

    bills = result.data
    if not bills:
        print("No bills with text found.")
        return

    print(f"Found {len(bills)} bills with text. Generating summaries...")

    success = 0
    errors = 0

    for i, bill in enumerate(bills, 1):
        bill_id = bill["bill_id"]
        title = bill.get("title", f"Bill {bill_id}")
        text = bill["text"]

        print(f"[{i}/{len(bills)}] {title[:60]}...", end=" ", flush=True)

        try:
            summary = generate_summary(claude, text)
            sb.table("bills").update({"description": summary}).eq("bill_id", bill_id).execute()
            print("✓")
            success += 1
        except anthropic.RateLimitError:
            print("rate limited, waiting 60s...")
            time.sleep(60)
            try:
                summary = generate_summary(claude, text)
                sb.table("bills").update({"description": summary}).eq("bill_id", bill_id).execute()
                print("✓ (retry)")
                success += 1
            except Exception as e:
                print(f"✗ ({e})")
                errors += 1
        except Exception as e:
            print(f"✗ ({e})")
            errors += 1

        if i < len(bills):
            time.sleep(BATCH_DELAY)

    print(f"\nDone. {success} updated, {errors} failed.")


if __name__ == "__main__":
    main()
