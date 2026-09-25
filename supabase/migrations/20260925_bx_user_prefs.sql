-- bx_user_prefs: per-user preferences for BX Reservations (theme + email notifications).
-- Mirrors the user_preferences pattern from BrainerdHQ (migration 0002 + 0077),
-- but scoped to BX-specific notification types and stored in its own table so
-- HQ/Personnel prefs don't bleed across apps.

create table if not exists public.bx_user_prefs (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  theme                        text,
  notify_reservation_confirmed boolean not null default true,
  notify_reservation_reminder  boolean not null default true,
  notify_admin_message         boolean not null default true,
  updated_at                   timestamptz not null default now()
);

-- Only the row owner can read or write their own prefs.
alter table public.bx_user_prefs enable row level security;

create policy "owner_select" on public.bx_user_prefs
  for select using (auth.uid() = user_id);

create policy "owner_upsert" on public.bx_user_prefs
  for insert with check (auth.uid() = user_id);

create policy "owner_update" on public.bx_user_prefs
  for update using (auth.uid() = user_id);

-- Index for the upsert pattern used by ProfileMenu and ThemeGrid
create index if not exists bx_user_prefs_user_id_idx on public.bx_user_prefs(user_id);
