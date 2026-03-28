-- Auth0 "sub" values are strings (e.g. "auth0|abc123"), not UUIDs.
-- Change user_id to text and add missing columns the app relies on.

alter table users alter column user_id drop default;
alter table users alter column user_id set data type text using user_id::text;

alter table users add column if not exists email text;
alter table users add column if not exists bias real;
