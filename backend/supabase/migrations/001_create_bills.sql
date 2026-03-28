create table if not exists bills (
    bill_id          integer primary key,
    bill_number      text,
    title            text,
    description      text,
    state            text,
    url              text,
    last_action      text,
    last_action_date text,
    text             text,
    created_at       timestamptz default now()
);

alter table bills enable row level security;

-- allow public read access
create policy "bills are publicly readable"
    on bills for select
    using (true);

-- only service role can insert/update
create policy "service role can upsert bills"
    on bills for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
