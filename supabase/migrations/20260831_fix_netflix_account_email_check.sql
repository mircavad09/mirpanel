-- The account repository canonicalizes valid Gmail dot/plus variants to
-- lowercase localpart@gmail.com before storage. PostgreSQL string literals
-- use one backslash for a literal regex dot; the prior doubled escape matched
-- a backslash and rejected valid canonical Gmail addresses.
alter table public.netflix_accounts
  drop constraint if exists netflix_accounts_email_check;

alter table public.netflix_accounts
  add constraint netflix_accounts_email_check
  check (email ~ '^[a-z0-9]+@gmail\.com$');
