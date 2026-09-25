-- ============================================================
-- BX Reservations — Blackout Rules
-- ============================================================

-- Rule types:
--   'dow'      — block an entire day of week every week
--                  data: { "dow": 0 }  (0=Sun, 1=Mon, … 6=Sat)
--   'dow_slot' — block a specific time slot on a day of week
--                  data: { "dow": 3, "slot": "evening" }
--   'date'     — block a specific calendar date
--                  data: { "date": "2026-12-25", "label": "Christmas" }

create table if not exists blackout_rules (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  rule_type   text not null check (rule_type in ('dow', 'dow_slot', 'date')),
  data        jsonb not null,
  label       text not null default '',
  active      boolean not null default true
);

-- Seed defaults: Sundays, Saturdays, Wednesday evenings
insert into blackout_rules (rule_type, data, label) values
  ('dow',      '{"dow": 0}',                        'Sundays'),
  ('dow',      '{"dow": 6}',                        'Saturdays'),
  ('dow_slot', '{"dow": 3, "slot": "evening"}',     'Wednesday evenings');

-- RLS — service role has full access; anon has read-only
alter table blackout_rules enable row level security;

create policy "anon_read_blackouts"
  on blackout_rules for select
  to anon
  using (active = true);
