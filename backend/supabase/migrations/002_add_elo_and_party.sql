alter table bills add column if not exists bill_elo integer default 1000;

create type party as enum ('Republican', 'Democratic', 'Independent');

create table if not exists parties (
    id         serial primary key,
    party      party not null,
    created_at timestamptz default now()
);

alter table parties enable row level security;

create policy "parties are publicly readable"
    on parties for select
    using (true);

create policy "service role can manage parties"
    on parties for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
