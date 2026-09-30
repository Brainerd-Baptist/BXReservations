-- Role access audit (2026-09-30)
--
-- Many policies still checked retired role names ('admin', 'staff',
-- 'superadmin') that no account has, so Owners, System Admins and Booking
-- Admins were treated as ordinary users by the database. Two policies also
-- exposed data to anyone holding the public (anon) key.
--
-- Access model, enforced here and mirrored in lib/roles.ts:
--   Staff   = owner, system_admin, booking_admin
--             read/write all reservation operations (reservations, history,
--             comments incl. internal, collaborators, organizations,
--             discounts, org links, room rates) and read settings.
--   Sysadmin = owner, system_admin  — manage roles (policy on bx_user_roles).
--   Everyone signed in (member, brainerd_staff, ministry_coordinator):
--             their own reservations (by account or contact email), plus ones
--             they are an accepted collaborator on; non-internal comments and
--             history on those; room rates; their own profile/prefs/notifications.
--   Anonymous: active blackout dates only. Agreement signing goes through the
--             server (token-checked), never straight to the table.
-- Writes that need to bypass these rules (booking submission, cron, e-mail
-- tokens) use the server's service key, which RLS does not apply to.

-- ── Helpers (SECURITY DEFINER: read roles without RLS, so no recursion) ──
create or replace function public.bx_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.bx_current_role() in ('owner', 'system_admin', 'booking_admin'), false)
$$;

create or replace function public.bx_is_sysadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.bx_current_role() in ('owner', 'system_admin'), false)
$$;

create or replace function public.bx_can_edit_reservation(res_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.bx_is_staff()
    or exists (
      select 1 from public.reservations r
      where r.id = res_id
        and (r.user_id = auth.uid() or lower(r.contact_email) = lower(auth.email()))
    )
    or exists (
      select 1 from public.reservation_collaborators c
      where c.reservation_id = res_id and c.user_id = auth.uid()
        and c.accepted_at is not null and c.collab_role = 'co_owner'
    )
$$;

create or replace function public.bx_can_view_reservation(res_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.bx_can_edit_reservation(res_id)
    or exists (
      select 1 from public.reservation_collaborators c
      where c.reservation_id = res_id and c.user_id = auth.uid() and c.accepted_at is not null
    )
$$;

-- The requester's own record (not staff, not collaborators)
create or replace function public.bx_is_requester(res_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reservations r
    where r.id = res_id
      and (r.user_id = auth.uid() or lower(r.contact_email) = lower(auth.email()))
  )
$$;

alter function public.bx_current_role() set search_path = public;
alter function public.bx_guard_map_label() set search_path = public;

revoke all on function public.bx_is_staff(), public.bx_is_sysadmin(),
  public.bx_can_edit_reservation(uuid), public.bx_can_view_reservation(uuid),
  public.bx_is_requester(uuid) from public, anon;
grant execute on function public.bx_is_staff(), public.bx_is_sysadmin(),
  public.bx_can_edit_reservation(uuid), public.bx_can_view_reservation(uuid),
  public.bx_is_requester(uuid) to authenticated;

-- ── reservations ──
drop policy if exists admins_read_all_reservations on public.reservations;
drop policy if exists admins_update_reservations on public.reservations;
drop policy if exists "anyone can insert" on public.reservations;       -- anon could insert any row, any status
drop policy if exists "users see own reservations" on public.reservations;
create policy reservations_select on public.reservations for select to authenticated
  using (public.bx_can_view_reservation(id));
create policy reservations_staff_update on public.reservations for update to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());

-- ── reservation_history ──
drop policy if exists "Admins can read all history" on public.reservation_history;
drop policy if exists "Users can read history for their reservations" on public.reservation_history;
create policy history_select on public.reservation_history for select to authenticated
  using (public.bx_can_view_reservation(reservation_id));
create policy history_staff_insert on public.reservation_history for insert to authenticated
  with check (public.bx_is_staff());

-- ── reservation_comments ──
drop policy if exists admin_insert_comments on public.reservation_comments;
drop policy if exists admin_read_all_comments on public.reservation_comments;
drop policy if exists admin_update_own_comments on public.reservation_comments;
drop policy if exists user_insert_own_comments on public.reservation_comments;
drop policy if exists user_read_own_comments on public.reservation_comments;
create policy comments_select on public.reservation_comments for select to authenticated
  using (public.bx_is_staff() or (internal_only = false and public.bx_can_view_reservation(reservation_id)));
create policy comments_staff_insert on public.reservation_comments for insert to authenticated
  with check (public.bx_is_staff());
create policy comments_user_insert on public.reservation_comments for insert to authenticated
  with check (internal_only = false and author_role = 'user' and public.bx_can_view_reservation(reservation_id));
create policy comments_staff_update_own on public.reservation_comments for update to authenticated
  using (author_id = auth.uid() and public.bx_is_staff());

-- ── reservation_collaborators (dedupe; add staff) ──
drop policy if exists collabs_select_own on public.reservation_collaborators;           -- duplicate of collaborators_select_own
drop policy if exists service_role_all on public.reservation_collaborators;             -- no-op: service key bypasses RLS
drop policy if exists owners_select_collabs on public.reservation_collaborators;
drop policy if exists owners_insert_collabs on public.reservation_collaborators;
create policy collabs_requester_select on public.reservation_collaborators for select to authenticated
  using (public.bx_is_staff() or public.bx_is_requester(reservation_id));
create policy collabs_requester_insert on public.reservation_collaborators for insert to authenticated
  with check (invited_by = auth.uid() and public.bx_can_edit_reservation(reservation_id));
drop policy if exists collaborators_insert_authenticated on public.reservation_collaborators; -- let anyone invite to any booking
create policy collabs_staff_delete on public.reservation_collaborators for delete to authenticated
  using (public.bx_is_staff());

-- ── reservation_agreements: server only (token checked in /api/agreements) ──
drop policy if exists anon_read_by_token on public.reservation_agreements;   -- was USING (true): every agreement readable with the public key
drop policy if exists anon_sign_customer on public.reservation_agreements;   -- anyone could sign any unsigned agreement
drop policy if exists service_role_all on public.reservation_agreements;     -- no-op
create policy agreements_select on public.reservation_agreements for select to authenticated
  using (public.bx_is_staff() or public.bx_is_requester(reservation_id));

-- ── organizations & friends ──
drop policy if exists admin_all_orgs on public.bx_organizations;
create policy orgs_staff_all on public.bx_organizations for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());
drop policy if exists user_read_own_org on public.bx_organizations;
create policy orgs_member_select on public.bx_organizations for select to authenticated
  using (exists (select 1 from public.bx_org_users ou where ou.org_id = bx_organizations.id and ou.user_id = auth.uid())
         or exists (select 1 from public.reservations r where r.organization_id = bx_organizations.id and r.user_id = auth.uid()));

drop policy if exists bx_discounts_admin_all on public.bx_discounts;
create policy discounts_staff_all on public.bx_discounts for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());

drop policy if exists bx_org_users_admin_all on public.bx_org_users;
create policy org_users_staff_all on public.bx_org_users for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());
create policy org_users_own_select on public.bx_org_users for select to authenticated
  using (user_id = auth.uid());

drop policy if exists bx_room_rates_admin_write on public.bx_room_rates;
drop policy if exists bx_room_rates_authenticated_read on public.bx_room_rates;
create policy room_rates_read on public.bx_room_rates for select to authenticated using (true);
create policy room_rates_staff_write on public.bx_room_rates for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());

-- ── settings: staff read (writes go through the server) ──
drop policy if exists admins_read_settings_v2 on public.bx_settings;
create policy settings_staff_read on public.bx_settings for select to authenticated
  using (public.bx_is_staff());

-- ── blackouts: signed-in people see them too, not just anonymous visitors ──
drop policy if exists anon_read_blackouts on public.blackout_rules;
create policy blackouts_read on public.blackout_rules for select to anon, authenticated
  using (active = true);
