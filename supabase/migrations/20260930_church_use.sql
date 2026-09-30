-- C4: church-use bookings (Ministry Coordinators, Brainerd Staff, staff).
-- church_use: fast-tracked in the admin queue and exempt from blackout dates.
-- waived: what this booking doesn't need — {"agreement":true,"coi":true,"payment":true}.
-- Set at booking time from the requester's role; staff can change it per booking.
alter table public.reservations add column if not exists church_use boolean not null default false;
alter table public.reservations add column if not exists waived jsonb not null default '{}'::jsonb;
