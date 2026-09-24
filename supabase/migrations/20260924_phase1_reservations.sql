-- ============================================================
-- BX Reservations — Phase 1 migration
-- ============================================================

create extension if not exists "pgcrypto";

-- Booking number generator: BX-YYYY-XXXX
create or replace function next_booking_number()
returns text language plpgsql as $$
declare
  yr  text := to_char(now(), 'YYYY');
  seq int;
begin
  select coalesce(max(
    cast(split_part(booking_number, '-', 3) as int)
  ), 0) + 1
  into seq
  from reservations
  where booking_number like 'BX-' || yr || '-%';

  if seq is null then seq := 1; end if;
  return 'BX-' || yr || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- Main reservations table
create table if not exists reservations (
  id              uuid primary key default gen_random_uuid(),
  booking_number  text unique not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  status          text not null default 'pending_insurance'
                  check (status in (
                    'pending_insurance','under_review','approved',
                    'confirmed','completed','cancelled'
                  )),
  contact_name    text not null,
  contact_email   text not null,
  contact_phone   text,
  contact_org     text,
  event_name      text not null,
  is_non_profit   boolean not null default false,
  space_mode      text not null default 'single'
                  check (space_mode in ('single','main-plus','multiple')),
  notes           text,
  payload         jsonb not null default '{}'
);

-- updated_at auto-stamp
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger reservations_updated_at
  before update on reservations
  for each row execute function set_updated_at();

-- Row Level Security (service key has full access; anon denied by default)
alter table reservations enable row level security;

-- Indexes
create index if not exists idx_reservations_email   on reservations (contact_email);
create index if not exists idx_reservations_status  on reservations (status);
create index if not exists idx_reservations_created on reservations (created_at desc);
