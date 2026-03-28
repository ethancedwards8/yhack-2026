alter table users enable row level security;

-- users can read their own row
create policy "users can read own row"
    on users for select
    using (auth.uid() = user_id);

-- users can update their own row
create policy "users can update own row"
    on users for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- new users can insert their own row
create policy "users can insert own row"
    on users for insert
    with check (auth.uid() = user_id);
