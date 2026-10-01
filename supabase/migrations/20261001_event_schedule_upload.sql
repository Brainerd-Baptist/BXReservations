-- ─── Event schedule upload fields ─────────────────────────────────────────────
-- Allows admin to request an event schedule from the organizer post-submission.
-- A unique token is generated per reservation for the organizer's upload link.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS schedule_upload_token  uuid,
  ADD COLUMN IF NOT EXISTS schedule_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_uploaded_at   timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_filename      text,
  ADD COLUMN IF NOT EXISTS schedule_url           text;

-- Index so we can look up a reservation by its upload token quickly
CREATE UNIQUE INDEX IF NOT EXISTS reservations_schedule_upload_token_idx
  ON reservations (schedule_upload_token)
  WHERE schedule_upload_token IS NOT NULL;

-- ─── Supabase Storage bucket for event schedules ──────────────────────────────
-- Private bucket — only service role can read; organizer uploads via signed URL.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-schedules', 'event-schedules', false)
  ON CONFLICT (id) DO NOTHING;

-- Admins (service role) can do anything in the bucket
CREATE POLICY IF NOT EXISTS "service_role_full_access_event_schedules"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'event-schedules');

-- Anon uploads are handled via the API route (service role), not directly,
-- so no anon insert policy needed here.
