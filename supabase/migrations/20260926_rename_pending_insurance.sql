-- Migration: rename pending_insurance → pending
-- Removes the "insurance" terminology from the status column

-- 1. Update any existing rows that have pending_insurance status
UPDATE reservations
SET status = 'pending'
WHERE status = 'pending_insurance';

-- 2. Drop old check constraint and add updated one
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN (
    'pending',
    'under_review',
    'approved',
    'confirmed',
    'completed',
    'cancelled'
  ));
