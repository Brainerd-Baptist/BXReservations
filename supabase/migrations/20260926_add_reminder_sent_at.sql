-- Add reminder_sent_at to reservations for 48-hour email cron idempotency
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
