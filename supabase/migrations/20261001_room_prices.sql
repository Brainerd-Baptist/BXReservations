-- One price list for rooms (v1.59), from the BX rate sheet: the booking page
-- estimate and the booking's charges both read it. Owner / System Admin edit
-- it in Settings. extra_hour = each hour past 4 (same for both rate types).
create table if not exists public.bx_room_prices (
  room_id    text primary key,
  block_np   numeric(10,2) not null check (block_np >= 0),
  block_std  numeric(10,2) not null check (block_std >= 0),
  extra_hour numeric(10,2) check (extra_hour >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.bx_room_prices enable row level security;  -- server (service role) only

insert into public.bx_room_prices (room_id, block_np, block_std, extra_hour) values
  ('crossing', 600, 800, 75),
  ('loft', 275, 475, 50),
  ('crossview', 200, 250, 25),
  ('crosspointe-a', 150, 200, 25),
  ('crosspointe-b', 150, 200, 25),
  ('crosspointe-c', 150, 200, 25),
  ('crosstiescafe', 175, 225, 25),
  ('crosstiesA', 125, 150, 25),
  ('crosstiesB', 125, 150, 25),
  ('crosstiesC', 125, 150, 25)
on conflict (room_id) do nothing;

-- Staff took over the room charges by hand → schedule edits stop recalculating them
alter table public.reservations add column if not exists rental_manual boolean not null default false;

-- Bookings staff already priced by hand keep their numbers
update public.reservations r set rental_manual = true
 where exists (select 1 from public.reservation_charges c where c.reservation_id = r.id and c.kind = 'rental');

-- One automatic line per room per day, even if two updates race
create unique index if not exists reservation_charges_one_rental_line
  on public.reservation_charges (reservation_id, auto_key) where auto_key like 'rental:%';

-- The old per-hour table (bx_room_rates) was never connected to anything; the
-- app no longer reads it. Drop it by hand when convenient:
--   drop table if exists public.bx_room_rates;

-- ── Add-ons from the BX "Additional Rental Services" sheet ───────────────────
-- rooms: only offered when the booking has one of these rooms (null = any).
-- pricing: {"type":"hours_tier","tiers":[[hours, price]...],"extra_hour":n}
--   for add-ons priced by each event day's hours (Complete AV package).
alter table public.bx_addons add column if not exists rooms text[];
alter table public.bx_addons add column if not exists pricing jsonb;

insert into public.bx_addons (name, description, unit, price, active, sort, rooms, pricing)
select v.name, v.description, v.unit, v.price, true, v.sort, v.rooms, v.pricing::jsonb from (values
  ('Black linen tablecloth', 'Fits 6'' tables or 72" round banquet tables. Reserve before your event.', 'each', 13, 10, null::text[], null::text),
  ('Handheld microphone', null, 'each', 35, 20, null::text[], null::text),
  ('UHF wireless microphone', 'For events in The Crossing.', 'each', 125, 30, array['crossing'], null::text),
  ('Complete AV package', 'Multi-screen projection, wireless or wired mic, computer input, and a Brainerd Baptist AV tech (required). Bring your own laptop.', 'per_day', 425, 40, array['crossing'], '{"type":"hours_tier","tiers":[[4,425],[8,525]],"extra_hour":40}'),
  ('AV setup — The Loft', 'Large-screen TV with HDMI, set up for your event. Bring your own laptop.', 'flat', 75, 50, array['loft'], null::text),
  ('AV setup — CrossPointe', 'Large-screen TV with HDMI, set up for your event. Bring your own laptop.', 'flat', 50, 60, array['crosspointe-a','crosspointe-b','crosspointe-c'], null::text)
) as v(name, description, unit, price, sort, rooms, pricing)
where not exists (select 1 from public.bx_addons a where a.name = v.name);

-- One line per hour-tiered add-on per day
create unique index if not exists reservation_charges_one_tier_line
  on public.reservation_charges (reservation_id, auto_key) where auto_key like 'tier:%';

-- ── Quotes for approval ───────────────────────────────────────────────────────
-- A frozen, itemized copy of a booking's charges, approved by the organizer
-- with a typed signature (which also signs the Facility Use Agreement when
-- agreement_text is set). Server (service role) only.
create table if not exists public.bx_quotes (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  version        int not null,
  token          text not null unique,
  lines          jsonb not null,
  subtotal       numeric(10,2) not null,
  discounts      numeric(10,2) not null default 0,
  total          numeric(10,2) not null,
  fingerprint    text not null,
  agreement_text text,
  schedule       jsonb,
  valid_until    date,
  note           text,
  sent_at        timestamptz not null default now(),
  sent_by        uuid,
  sent_to        text,
  accepted_at    timestamptz,
  accepted_name  text,
  accepted_ip    text,
  accepted_ua    text,
  superseded_at  timestamptz,
  unique (reservation_id, version)
);
alter table public.bx_quotes enable row level security;
create index if not exists bx_quotes_reservation_idx on public.bx_quotes (reservation_id, version desc);

-- The organizer can ask for changes instead of approving (reason required)
alter table public.bx_quotes add column if not exists declined_at timestamptz;
alter table public.bx_quotes add column if not exists decline_reason text;
alter table public.bx_quotes add column if not exists declined_name text;
