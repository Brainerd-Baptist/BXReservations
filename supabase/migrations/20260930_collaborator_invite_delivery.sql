-- Track whether each invitation email went out (applied 2026-09-30)
alter table public.reservation_collaborators
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_error text;
