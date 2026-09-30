-- Post-event guest survey (Net Promoter + category ratings + effort), the
-- survey thank-you reward, and follow-up tracking. Server-only tables.
create table if not exists public.bx_surveys (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  token text not null unique,
  email text,
  sent_at timestamptz not null default now(),
  reminded_at timestamptz,
  submitted_at timestamptz,
  nps smallint check (nps between 0 and 10),
  reason text check (char_length(reason) <= 2000),
  ratings jsonb not null default '{}'::jsonb,
  ease smallint check (ease between 1 and 5),
  improve text check (char_length(improve) <= 2000),
  share_ok boolean not null default false,
  contact_ok boolean not null default true,
  followup_needed boolean not null default false,
  followed_up_at timestamptz,
  followed_up_by text,
  followup_note text check (char_length(followup_note) <= 2000)
);
create index if not exists bx_surveys_submitted_idx on public.bx_surveys (submitted_at desc);
alter table public.bx_surveys enable row level security;
revoke all on public.bx_surveys from anon, authenticated;

create table if not exists public.bx_rewards (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  source_survey_id uuid references public.bx_surveys(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_reservation_id uuid references public.reservations(id) on delete set null,
  redeemed_at timestamptz
);
create index if not exists bx_rewards_email_idx on public.bx_rewards (lower(email)) where redeemed_reservation_id is null;
alter table public.bx_rewards enable row level security;
revoke all on public.bx_rewards from anon, authenticated;

alter table public.reservations add column if not exists reward_id uuid references public.bx_rewards(id) on delete set null;
-- Lines the app keeps in sync itself (e.g. the survey thank-you discount)
alter table public.reservation_charges add column if not exists auto_key text;

insert into public.bx_settings (key, value, description) values
  ('survey_reward_percent', '10', 'Survey thank-you: % off the next booking (0 = off)'),
  ('survey_reward_months', '12', 'Survey thank-you: months before it expires'),
  ('google_review_url', '', 'Link that opens your Google review form')
on conflict (key) do nothing;

-- sent_at = when the thank-you email actually went out (null if the survey was
-- only opened from the booking page); one reward line per booking.
alter table public.bx_surveys alter column sent_at drop not null, alter column sent_at drop default;
create unique index if not exists reservation_charges_one_reward on public.reservation_charges (reservation_id) where auto_key = 'reward';
