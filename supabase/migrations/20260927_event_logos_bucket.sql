-- Event Map · Phase B (logos) — private storage for renters' logos.
--
-- One bucket, `event-logos`, private. Objects live at
--   <reservation_id>/original.<ext>   the file as uploaded (kept)
--   <reservation_id>/logo.png         normalised: trimmed, ≤2400 px, transparent PNG
-- Only the server (service role) reads or writes it; the app hands out
-- short-lived signed URLs. No client policies are needed for that, so none
-- are created — a future policy would only be required if the browser ever
-- talks to the bucket directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-logos',
  'event-logos',
  false,
  10485760,                                                   -- 10 MB
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Review notes and normalisation facts ride in reservations.logo_meta (jsonb,
-- added by 20260926_event_map.sql):
--   { original: {format, width, height, bytes}, normalized: {width, height, bytes},
--     soft: boolean (trimmed width under 600 px — may print soft),
--     uploaded_by: uuid, uploaded_at: iso, review_note: text|null }
comment on column public.reservations.logo_meta is
  'Event logo facts: original + normalised dimensions, soft-print flag, uploader, review note';
