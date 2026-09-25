-- ============================================================
-- BX Reservations — Roles, Ministries & Collaboration
-- ============================================================

-- --------------------------------------------------------
-- 1. Role enum helper (used in check constraints)
-- --------------------------------------------------------
-- Roles in ascending privilege order:
--   member < ministry_coordinator < booking_admin < system_admin < owner

create table if not exists public.bx_user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'member'
               check (role in ('owner','system_admin','booking_admin','ministry_coordinator','member')),
  assigned_by  uuid references auth.users(id) on delete set null,
  assigned_at  timestamptz not null default now()
);

alter table public.bx_user_roles enable row level security;

-- Members can read their own role (needed for client-side permission checks)
create policy "owner_select_own_role"
  on public.bx_user_roles for select
  using (auth.uid() = user_id);

-- Booking admin+ can read all roles (for user management UI)
create policy "admin_select_all_roles"
  on public.bx_user_roles for select
  using (
    exists (
      select 1 from public.bx_user_roles r
      where r.user_id = auth.uid()
        and r.role in ('owner','system_admin','booking_admin')
    )
  );

-- System admin+ can insert/update roles (but not promote above their own level)
create policy "system_admin_manage_roles"
  on public.bx_user_roles for all
  using (
    exists (
      select 1 from public.bx_user_roles r
      where r.user_id = auth.uid()
        and r.role in ('owner','system_admin')
    )
  )
  with check (
    -- owners can set any role; system_admins cannot create other owners/system_admins
    exists (
      select 1 from public.bx_user_roles r
      where r.user_id = auth.uid()
        and (
          r.role = 'owner'
          or (r.role = 'system_admin' and role not in ('owner','system_admin'))
        )
    )
  );

-- --------------------------------------------------------
-- 2. SQL helper functions
-- --------------------------------------------------------

-- Returns the calling user's BX role (null if unauthenticated or no row)
create or replace function public.bx_role()
returns text language sql security definer stable as $$
  select role from public.bx_user_roles where user_id = auth.uid()
$$;

-- True if calling user's role is at or above min_role in the hierarchy
create or replace function public.bx_has_role(min_role text)
returns boolean language sql security definer stable as $$
  select coalesce(public.bx_role(), 'guest') = any(
    case min_role
      when 'owner'                then array['owner']
      when 'system_admin'         then array['owner','system_admin']
      when 'booking_admin'        then array['owner','system_admin','booking_admin']
      when 'ministry_coordinator' then array['owner','system_admin','booking_admin','ministry_coordinator']
      when 'member'               then array['owner','system_admin','booking_admin','ministry_coordinator','member']
      else array[]::text[]
    end
  )
$$;

-- --------------------------------------------------------
-- 3. Ministries
-- --------------------------------------------------------

create table if not exists public.bx_ministries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.bx_ministries enable row level security;

-- All authenticated users can read ministries (needed for booking form dropdown)
create policy "members_read_ministries"
  on public.bx_ministries for select
  to authenticated
  using (true);

-- System admin+ can manage ministries
create policy "admin_manage_ministries"
  on public.bx_ministries for all
  using (public.bx_has_role('system_admin'))
  with check (public.bx_has_role('system_admin'));

-- --------------------------------------------------------
-- 4. Ministry membership
-- --------------------------------------------------------

create table if not exists public.bx_ministry_members (
  id              uuid primary key default gen_random_uuid(),
  ministry_id     uuid not null references public.bx_ministries(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  is_coordinator  boolean not null default false,
  added_by        uuid references auth.users(id) on delete set null,
  added_at        timestamptz not null default now(),
  unique (ministry_id, user_id)
);

create index if not exists bx_ministry_members_user_idx
  on public.bx_ministry_members(user_id);
create index if not exists bx_ministry_members_ministry_idx
  on public.bx_ministry_members(ministry_id);

alter table public.bx_ministry_members enable row level security;

-- Members can read their own ministry memberships
create policy "member_read_own_memberships"
  on public.bx_ministry_members for select
  using (auth.uid() = user_id);

-- Ministry coordinators can read all members of their own ministry
create policy "coordinator_read_ministry_members"
  on public.bx_ministry_members for select
  using (
    exists (
      select 1 from public.bx_ministry_members m
      where m.ministry_id = bx_ministry_members.ministry_id
        and m.user_id = auth.uid()
        and m.is_coordinator = true
    )
  );

-- Booking admin+ can read all memberships
create policy "admin_read_all_memberships"
  on public.bx_ministry_members for select
  using (public.bx_has_role('booking_admin'));

-- Coordinators can add/remove members of their own ministry (not set coordinator flag)
create policy "coordinator_manage_own_ministry"
  on public.bx_ministry_members for all
  using (
    exists (
      select 1 from public.bx_ministry_members m
      where m.ministry_id = bx_ministry_members.ministry_id
        and m.user_id = auth.uid()
        and m.is_coordinator = true
    )
  )
  with check (is_coordinator = false);  -- coordinators cannot promote others to coordinator

-- System admin+ can manage all memberships including coordinator flag
create policy "admin_manage_all_memberships"
  on public.bx_ministry_members for all
  using (public.bx_has_role('system_admin'))
  with check (public.bx_has_role('system_admin'));

-- --------------------------------------------------------
-- 5. Alter reservations — add ownership & ministry columns
-- --------------------------------------------------------

alter table public.reservations
  add column if not exists owner_id    uuid references auth.users(id) on delete set null,
  add column if not exists ministry_id uuid references public.bx_ministries(id) on delete set null,
  add column if not exists booked_by_id uuid references auth.users(id) on delete set null;
  -- owner_id:     the authenticated user who owns this reservation
  -- ministry_id:  optional — ministry this reservation is booked under
  -- booked_by_id: set when admin/coordinator booked on behalf of someone else

create index if not exists idx_reservations_owner_id
  on public.reservations(owner_id);
create index if not exists idx_reservations_ministry_id
  on public.reservations(ministry_id);

-- --------------------------------------------------------
-- 6. Reservation RLS — extend existing policies
-- --------------------------------------------------------

-- Members can see their own reservations
create policy "member_select_own_reservations"
  on public.reservations for select
  to authenticated
  using (owner_id = auth.uid());

-- Members can insert reservations (owner_id must match their own uid)
create policy "member_insert_reservation"
  on public.reservations for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Members can update their own pending/under_review reservations
create policy "member_update_own_pending"
  on public.reservations for update
  to authenticated
  using (
    owner_id = auth.uid()
    and status in ('pending_insurance','under_review')
  )
  with check (owner_id = auth.uid());

-- Booking admin+ can see and manage all reservations
create policy "admin_all_reservations"
  on public.reservations for all
  using (public.bx_has_role('booking_admin'))
  with check (public.bx_has_role('booking_admin'));

-- Ministry coordinators can see reservations for their ministry
create policy "coordinator_see_ministry_reservations"
  on public.reservations for select
  to authenticated
  using (
    ministry_id is not null
    and exists (
      select 1 from public.bx_ministry_members m
      where m.ministry_id = reservations.ministry_id
        and m.user_id = auth.uid()
        and m.is_coordinator = true
    )
  );

-- --------------------------------------------------------
-- 7. Reservation collaborators
-- --------------------------------------------------------

create table if not exists public.reservation_collaborators (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  -- null when invite is pending (user hasn't registered yet)
  collab_role     text not null default 'co_owner'
                  check (collab_role in ('co_owner','viewer')),
  invited_email   text,           -- always set; used for display + matching on registration
  invited_by      uuid references auth.users(id) on delete set null,
  invite_token    text unique,    -- tokenized link for non-registered invitees
  accepted_at     timestamptz,    -- null = invite pending
  created_at      timestamptz not null default now(),
  -- at least one of user_id or invited_email must be present
  constraint collab_has_identity check (user_id is not null or invited_email is not null)
);

create index if not exists collab_reservation_idx
  on public.reservation_collaborators(reservation_id);
create index if not exists collab_user_idx
  on public.reservation_collaborators(user_id);
create index if not exists collab_token_idx
  on public.reservation_collaborators(invite_token);
create index if not exists collab_email_idx
  on public.reservation_collaborators(invited_email);

alter table public.reservation_collaborators enable row level security;

-- Collaborators can read their own rows
create policy "collab_read_own"
  on public.reservation_collaborators for select
  to authenticated
  using (user_id = auth.uid());

-- Reservation owners and co-owners can read all collaborators on their reservation
create policy "owner_read_reservation_collabs"
  on public.reservation_collaborators for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_collaborators.reservation_id
        and r.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.reservation_collaborators c2
      where c2.reservation_id = reservation_collaborators.reservation_id
        and c2.user_id = auth.uid()
        and c2.collab_role = 'co_owner'
    )
  );

-- Booking admin+ can read all collaborators
create policy "admin_read_all_collabs"
  on public.reservation_collaborators for select
  using (public.bx_has_role('booking_admin'));

-- Reservation owners and co-owners can add collaborators
create policy "owner_add_collabs"
  on public.reservation_collaborators for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_collaborators.reservation_id
        and r.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.reservation_collaborators c2
      where c2.reservation_id = reservation_collaborators.reservation_id
        and c2.user_id = auth.uid()
        and c2.collab_role = 'co_owner'
        -- co-owners can only add viewers, not other co-owners
        and reservation_collaborators.collab_role = 'viewer'
    )
  );

-- Reservation owners can remove any collaborator;
-- co-owners can remove viewers only
create policy "owner_remove_collabs"
  on public.reservation_collaborators for delete
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_collaborators.reservation_id
        and r.owner_id = auth.uid()
    )
    or (
      collab_role = 'viewer'
      and exists (
        select 1 from public.reservation_collaborators c2
        where c2.reservation_id = reservation_collaborators.reservation_id
          and c2.user_id = auth.uid()
          and c2.collab_role = 'co_owner'
      )
    )
  );

-- Anon: accept an invite via token (sets user_id + accepted_at)
create policy "anon_accept_invite"
  on public.reservation_collaborators for update
  to anon
  using (invite_token is not null and accepted_at is null)
  with check (accepted_at is not null);

-- Authenticated users can accept their own pending invite
create policy "user_accept_own_invite"
  on public.reservation_collaborators for update
  to authenticated
  using (
    (user_id = auth.uid() or invited_email = (select email from auth.users where id = auth.uid()))
    and accepted_at is null
  )
  with check (user_id = auth.uid() and accepted_at is not null);

-- Booking admin+ can manage all collaborators
create policy "admin_manage_all_collabs"
  on public.reservation_collaborators for all
  using (public.bx_has_role('booking_admin'))
  with check (public.bx_has_role('booking_admin'));

-- --------------------------------------------------------
-- 8. RLS: collaborators can see shared reservations
-- --------------------------------------------------------

create policy "collab_see_shared_reservation"
  on public.reservations for select
  to authenticated
  using (
    exists (
      select 1 from public.reservation_collaborators c
      where c.reservation_id = reservations.id
        and c.user_id = auth.uid()
        and c.accepted_at is not null
    )
  );

-- --------------------------------------------------------
-- 9. Ownership transfer trigger
-- --------------------------------------------------------
-- When a user is deleted, their reservations either transfer
-- to the oldest co-owner, or become orphaned (owner_id = null).
-- The reservation_collaborators row for the deleted user is
-- cleaned up by the on delete cascade on user_id.

create or replace function public.transfer_reservation_ownership()
returns trigger language plpgsql security definer as $$
declare
  res record;
  new_owner uuid;
begin
  -- For each reservation owned by the deleted user
  for res in
    select id from public.reservations
    where owner_id = old.id
  loop
    -- Find the oldest co-owner collaborator
    select c.user_id into new_owner
    from public.reservation_collaborators c
    where c.reservation_id = res.id
      and c.collab_role = 'co_owner'
      and c.user_id is not null
      and c.user_id != old.id
      and c.accepted_at is not null
    order by c.created_at asc
    limit 1;

    -- Transfer or orphan
    update public.reservations
    set owner_id = new_owner  -- null if no co-owner found
    where id = res.id;
  end loop;

  return old;
end;
$$;

create trigger on_user_deleted_transfer_reservations
  before delete on auth.users
  for each row execute function public.transfer_reservation_ownership();

-- --------------------------------------------------------
-- 10. Auto-link pending invites when a new user registers
-- --------------------------------------------------------
-- When a new user signs up, check if any pending collab invites
-- exist for their email and link them automatically.

create or replace function public.link_pending_collab_invites()
returns trigger language plpgsql security definer as $$
begin
  update public.reservation_collaborators
  set
    user_id     = new.id,
    accepted_at = now()
  where invited_email = new.email
    and user_id is null
    and accepted_at is null;

  return new;
end;
$$;

create trigger on_user_created_link_invites
  after insert on auth.users
  for each row execute function public.link_pending_collab_invites();
