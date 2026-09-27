-- Add PCO Calendar event ID to reservations for write-back integration
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS pco_event_id text;

COMMENT ON COLUMN reservations.pco_event_id IS
  'Planning Center Calendar event ID created on submission; used to update tags on approval/cancellation.';
