-- Phase 1: Organizations, Discounts, Room Rates
-- Applied 2026-09-28 via Supabase MCP (schema introspected from live DB)

-- ─── bx_organizations ────────────────────────────────────────────────────────
create table if not exists public.bx_organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  canonical_name        text,              -- lowercase slug, used for dedup matching
  primary_contact_name  text,
  primary_contact_email text,
  phone                 text,
  address               text,
  tier                  text default 'external'
                          check (tier in ('internal', 'bbs', 'external')),
  notes                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz
);

-- ─── bx_org_users (join table) ───────────────────────────────────────────────
create table if not exists public.bx_org_users (
  org_id     uuid not null references public.bx_organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  linked_at  timestamptz not null default now(),
  linked_by  uuid references auth.users(id),
  primary key (org_id, user_id)
);

-- ─── bx_room_rates (rack rate per room) ─────────────────────────────────────
create table if not exists public.bx_room_rates (
  id              uuid primary key default gen_random_uuid(),
  room_id         text not null,           -- matches existing room slug/id
  rate_per_hour   numeric(8,2) not null check (rate_per_hour >= 0),
  effective_date  date not null default current_date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (room_id, effective_date)
);

-- ─── bx_discounts ────────────────────────────────────────────────────────────
-- org_id-only row  → standing org-level default (reservation_id IS NULL)
-- reservation_id-only row → per-booking override (org_id IS NULL)
-- check bx_discounts_has_scope enforces at least one is set
create table if not exists public.bx_discounts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.bx_organizations(id) on delete cascade,
  reservation_id   uuid references public.reservations(id) on delete cascade,
  type             text not null check (type in ('percent', 'flat_dollar', 'room_rate_override')),
  value            numeric(8,2) not null check (value >= 0),
  scope            text not null default 'all_rooms'
                     check (scope in ('all_rooms', 'specific_room')),
  room_id          text,                   -- populated when scope = 'specific_room'
  discount_reason  text check (discount_reason in (
                     'bbs_default',
                     'bx_ministry_initiative',
                     'nonprofit_partner',
                     'staff_courtesy',
                     'other'
                   )),
  note             text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  constraint bx_discounts_has_scope check (org_id is not null or reservation_id is not null)
);

-- ─── reservations — Phase 1 columns ─────────────────────────────────────────
alter table public.reservations
  add column if not exists organization_id  uuid references public.bx_organizations(id),
  add column if not exists rack_rate_total  numeric(8,2),
  add column if not exists discount_applied numeric(8,2),
  add column if not exists net_amount       numeric(8,2);

-- Note: org_name_raw (preserve user-typed org string) is defined in scope but
-- was not applied to the live DB. Add here so future migrations stay in sync:
alter table public.reservations
  add column if not exists org_name_raw text;
