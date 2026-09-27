-- Event Map · Phase B — per-reservation sign options and venue info for the attendee packet.
alter table public.reservations
  add column if not exists sign_options jsonb not null default '{}'::jsonb;
comment on column public.reservations.sign_options is 'Door-sign options: { qr: boolean } (QR on by default)';

-- Venue facts shown to attendees (packet + cover). Admin-editable; empty values are simply omitted.
insert into public.bx_settings (key, value) values
  ('venue_name', 'The BX at Brainerd Baptist Church'),
  ('venue_address', ''),
  ('venue_maps_url', ''),
  ('venue_parking', ''),
  ('venue_arrival', ''),
  ('venue_contact', '')
on conflict (key) do nothing;
