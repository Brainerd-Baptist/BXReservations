-- Phase 6: measure the booking funnel. Written only by the server (service key);
-- read only through the staff Insights API. No personal data: a random per-tab
-- session id, the event, the step, and a short reason for failures.
create table if not exists public.bx_funnel_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null check (char_length(session_id) between 8 and 64),
  event text not null check (event in ('reserve_view','step_reached','submit_attempt','submit_ok','submit_fail')),
  step smallint check (step between 0 and 10),
  detail text check (char_length(detail) <= 120),
  signed_in boolean not null default false
);
create index if not exists bx_funnel_events_created_idx on public.bx_funnel_events (created_at desc);
alter table public.bx_funnel_events enable row level security;
revoke all on public.bx_funnel_events from anon, authenticated;
