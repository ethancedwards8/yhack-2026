-- Run this in Supabase: SQL Editor → New query → Run.
-- Creates the table used by GET/POST /api/demo-items.

create table if not exists public.demo_items (
    id uuid primary key default gen_random_uuid (),
    body text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists demo_items_created_at_idx on public.demo_items (created_at desc);

-- Flask uses DATABASE_URL (Postgres role). For browser + anon key later, enable RLS and add policies in Supabase.
