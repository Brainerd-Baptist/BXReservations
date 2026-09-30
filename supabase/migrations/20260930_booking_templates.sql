-- Booking templates: a saved room + setup + time + headcount pattern (no
-- dates) that renters start a new request from. Staff-made; shown to everyone
-- or to one organization's linked members. Server-only (service key).
create table if not exists public.bx_booking_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  org_id uuid references public.bx_organizations(id) on delete cascade,
  pattern jsonb not null,
  source_reservation_id uuid references public.reservations(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bx_booking_templates_org_idx on public.bx_booking_templates (org_id) where active;
alter table public.bx_booking_templates enable row level security;
revoke all on public.bx_booking_templates from anon, authenticated;
