-- ============================================================
-- BX Reservations — Event Map (Phase A)
-- A planner's own room names, setups and notes laid over the
-- BX building map for one reservation. Design:
--   Brainerd HQ › claude/bx-map-event-layer-design-2026-09-26.md
--
-- Written against the LIVE schema as of 2026-09-26:
--   reservations.user_id (no owner_id / ministry_id yet),
--   bx_user_roles(role) holding 'admin'/'user' (the six-role
--   migration in this folder has not been applied to the
--   database). The helpers below accept both role vocabularies
--   so nothing here has to change when that migration lands;
--   ministry-coordinator access is added then.
-- ============================================================

-- --------------------------------------------------------
-- 1. Helpers: who is staff, who may edit / view a reservation
-- --------------------------------------------------------

create or replace function public.bx_is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.bx_user_roles r
    where r.user_id = auth.uid()
      and r.role in ('admin','owner','system_admin','booking_admin')
  )
$$;

create or replace function public.bx_can_edit_reservation(res_id uuid)
returns boolean language sql security definer stable as $$
  select
    public.bx_is_staff()
    or exists (
      select 1 from public.reservations r
      where r.id = res_id
        and (
          r.user_id = auth.uid()
          or lower(r.contact_email) = lower((select email from auth.users where id = auth.uid()))
        )
    )
    or exists (
      select 1 from public.reservation_collaborators c
      where c.reservation_id = res_id
        and c.user_id = auth.uid()
        and c.accepted_at is not null
        and c.collab_role = 'co_owner'
    )
$$;

create or replace function public.bx_can_view_reservation(res_id uuid)
returns boolean language sql security definer stable as $$
  select
    public.bx_can_edit_reservation(res_id)
    or exists (
      select 1 from public.reservation_collaborators c
      where c.reservation_id = res_id
        and c.user_id = auth.uid()
        and c.accepted_at is not null
    )
$$;

-- --------------------------------------------------------
-- 2. Labels: one row per (reservation, map room, day)
--    day_index = -1  → applies to every day of the event
--    day_index >= 0  → that day only ("Vary by day"); the
--                      -1 row still carries the name + notes
-- --------------------------------------------------------

create table if not exists public.reservation_map_labels (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  room_id         text not null,                      -- the map's stable id: 'l-cp-a', 'u-loft', 'l-checkin' …
  level           text not null check (level in ('lower','upper')),
  day_index       int  not null default -1 check (day_index >= -1),
  event_name      text check (event_name is null or char_length(event_name) <= 24),
  setup_style     text check (setup_style is null or setup_style in
                    ('theater','classroom','rounds_8','rounds_10','ushape','boardroom','open','stations','asis')),
  chairs          int  not null default 0 check (chairs between 0 and 999),
  tables_6ft      int  not null default 0 check (tables_6ft between 0 and 999),
  tables_8ft      int  not null default 0 check (tables_8ft between 0 and 999),
  tables_round    int  not null default 0 check (tables_round between 0 and 999),
  notes           text check (notes is null or char_length(notes) <= 500),             -- planner-facing
  staff_notes     text check (staff_notes is null or char_length(staff_notes) <= 500), -- staff only
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (reservation_id, room_id, day_index)
);

create index if not exists reservation_map_labels_reservation_idx
  on public.reservation_map_labels(reservation_id);

drop trigger if exists reservation_map_labels_updated_at on public.reservation_map_labels;
create trigger reservation_map_labels_updated_at
  before update on public.reservation_map_labels
  for each row execute function public.set_updated_at();

alter table public.reservation_map_labels enable row level security;

drop policy if exists "event_map_read"   on public.reservation_map_labels;
drop policy if exists "event_map_insert" on public.reservation_map_labels;
drop policy if exists "event_map_update" on public.reservation_map_labels;
drop policy if exists "event_map_delete" on public.reservation_map_labels;

create policy "event_map_read"
  on public.reservation_map_labels for select
  to authenticated
  using (public.bx_can_view_reservation(reservation_id));

create policy "event_map_insert"
  on public.reservation_map_labels for insert
  to authenticated
  with check (public.bx_can_edit_reservation(reservation_id));

create policy "event_map_update"
  on public.reservation_map_labels for update
  to authenticated
  using (public.bx_can_edit_reservation(reservation_id))
  with check (public.bx_can_edit_reservation(reservation_id));

create policy "event_map_delete"
  on public.reservation_map_labels for delete
  to authenticated
  using (public.bx_can_edit_reservation(reservation_id));

-- staff_notes: only staff may write them (the API also strips them from
-- non-staff reads); updated_by always records the caller.
create or replace function public.bx_guard_map_label()
returns trigger language plpgsql security definer as $$
begin
  if not public.bx_is_staff() then
    if tg_op = 'INSERT' then
      new.staff_notes := null;
    else
      new.staff_notes := old.staff_notes;
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists reservation_map_labels_guard on public.reservation_map_labels;
create trigger reservation_map_labels_guard
  before insert or update on public.reservation_map_labels
  for each row execute function public.bx_guard_map_label();

-- --------------------------------------------------------
-- 3. Reservation logo (Phase B uses it; the columns land now
--    so the reservation shape is stable for the map page)
-- --------------------------------------------------------

alter table public.reservations
  add column if not exists logo_path          text,   -- normalised PNG in the private 'event-logos' bucket
  add column if not exists logo_original_path text,   -- as uploaded
  add column if not exists logo_meta          jsonb,  -- {width, height, format, uploaded_by, uploaded_at, low_res}
  add column if not exists logo_status        text not null default 'none'
                                              check (logo_status in ('none','pending','approved','rejected')),
  add column if not exists logo_reviewed_by   uuid references auth.users(id) on delete set null,
  add column if not exists logo_reviewed_at   timestamptz;

-- --------------------------------------------------------
-- 4. Share links (Phase B) — schema only; no public read
--    policy exists yet, so nothing is exposed.
-- --------------------------------------------------------

create table if not exists public.reservation_map_shares (
  reservation_id  uuid primary key references public.reservations(id) on delete cascade,
  token           text not null unique,
  enabled         boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);

alter table public.reservation_map_shares enable row level security;

drop policy if exists "map_share_manage" on public.reservation_map_shares;
create policy "map_share_manage"
  on public.reservation_map_shares for all
  to authenticated
  using (public.bx_can_edit_reservation(reservation_id))
  with check (public.bx_can_edit_reservation(reservation_id));
