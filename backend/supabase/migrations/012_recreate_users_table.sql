drop table if exists public.users;

create table public.users (
  user_id uuid not null,
  name text not null,
  email text null,
  bias real null default 0.5,
  state text null,
  constraint users_pkey primary key (user_id),
  constraint users_user_id_fkey foreign key (user_id) references auth.users (id)
) tablespace pg_default;

alter table public.users enable row level security;

create policy "users can read own row"
  on public.users for select
  using (auth.uid() = user_id);

create policy "users can update own row"
  on public.users for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can insert own row"
  on public.users for insert
  with check (auth.uid() = user_id);

create policy "service role full access"
  on public.users for all
  using (auth.role() = 'service_role');
