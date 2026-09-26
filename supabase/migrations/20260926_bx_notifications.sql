-- bx_notifications: lightweight in-app bell notifications for BX Reservations.
-- Rows are created server-side (service role) when reservation status changes.
-- Users read their own unread rows; admins read theirs.

create table if not exists public.bx_notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  reservation_id  uuid references public.reservations(id) on delete cascade,
  type            text not null,   -- 'status_update' | 'new_reservation' | 'reminder'
  title           text not null,
  body            text,
  read_at         timestamptz,     -- null = unread
  created_at      timestamptz not null default now()
);

alter table public.bx_notifications enable row level security;

-- Users can read and update (mark read) their own notifications
create policy "owner_select" on public.bx_notifications
  for select using (auth.uid() = user_id);

create policy "owner_update" on public.bx_notifications
  for update using (auth.uid() = user_id);

-- Service role inserts (server-side only, no user insert policy needed)

create index if not exists bx_notifications_user_unread_idx
  on public.bx_notifications (user_id, read_at)
  where read_at is null;

create index if not exists bx_notifications_reservation_idx
  on public.bx_notifications (reservation_id);
