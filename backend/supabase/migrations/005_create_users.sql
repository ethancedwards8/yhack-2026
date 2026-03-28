create table if not exists users (
    user_id uuid primary key default gen_random_uuid(),
    name text not null
);
