-- Applied to production 2026-09-30.
-- The old policy queried bx_user_roles from inside a bx_user_roles policy
-- (Postgres: "infinite recursion detected in policy") and used retired role
-- names. Replace it with a SECURITY DEFINER helper that reads the caller's
-- role without RLS.
create or replace function public.bx_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.bx_user_roles where user_id = auth.uid()
$$;

revoke all on function public.bx_current_role() from public;
grant execute on function public.bx_current_role() to authenticated;

drop policy if exists admins_manage_all_roles on public.bx_user_roles;
create policy admins_manage_all_roles on public.bx_user_roles
  for all to authenticated
  using (public.bx_current_role() in ('owner', 'system_admin'))
  with check (public.bx_current_role() in ('owner', 'system_admin'));
