-- Billing: add-on catalog, per-booking charges, multiple payments, reminders
-- Balance due = sum(reservation_charges.amount) - sum(reservation_payments.amount)

-- ── Add-on catalog (tablecloths, supplies, services) ──
create table if not exists public.bx_addons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  unit        text not null default 'each' check (unit in ('each', 'per_day', 'flat')),
  price       numeric(10,2) not null default 0 check (price >= 0),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Line items on a booking ──
-- kind: rental (room fee), addon (from catalog), fee (other charge), discount (negative)
create table if not exists public.reservation_charges (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  kind           text not null check (kind in ('rental', 'addon', 'fee', 'discount')),
  addon_id       uuid references public.bx_addons(id) on delete set null,
  label          text not null,
  unit_price     numeric(10,2) not null,
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  amount         numeric(10,2) generated always as (round(unit_price * quantity, 2)) stored,
  note           text,
  added_by       uuid references auth.users(id),
  added_by_staff boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists reservation_charges_res_idx on public.reservation_charges(reservation_id);

-- ── Payments (several per booking: deposits, partials) ──
create table if not exists public.reservation_payments (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  amount         numeric(10,2) not null check (amount > 0),
  method         text not null,
  received_at    date not null default current_date,
  receipt_url    text,
  note           text,
  recorded_by    uuid references auth.users(id),
  recorded_by_name text,
  created_at     timestamptz not null default now()
);
create index if not exists reservation_payments_res_idx on public.reservation_payments(reservation_id);

-- ── Reminder log (so the hourly job never repeats a reminder) ──
create table if not exists public.reservation_payment_reminders (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  kind           text not null,            -- 'auto:14', 'auto:3', 'manual'
  balance        numeric(10,2) not null,
  sent_to        text not null,
  sent_by        uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
create index if not exists reservation_payment_reminders_res_idx on public.reservation_payment_reminders(reservation_id);

-- Carry over payments recorded the old way (one per booking)
insert into public.reservation_payments (reservation_id, amount, method, received_at, receipt_url, recorded_by_name)
select r.id, r.payment_amount, coalesce(nullif(r.payment_method, ''), 'Other'),
       coalesce(r.payment_received_at::date, r.created_at::date), r.payment_receipt_url, r.payment_recorded_by
from public.reservations r
where r.payment_amount is not null and r.payment_amount > 0
  and not exists (select 1 from public.reservation_payments p where p.reservation_id = r.id);

-- Reminder schedule setting (days before the event; two reminders)
insert into public.bx_settings (key, value)
values ('payment_reminder_1_days', '14'), ('payment_reminder_2_days', '3')
on conflict (key) do nothing;

-- ── Row-level rules (same model as the role audit) ──
alter table public.bx_addons enable row level security;
alter table public.reservation_charges enable row level security;
alter table public.reservation_payments enable row level security;
alter table public.reservation_payment_reminders enable row level security;

create policy addons_public_read on public.bx_addons for select to anon using (active);
create policy addons_read on public.bx_addons for select to authenticated using (active or public.bx_is_staff());
create policy addons_sysadmin_write on public.bx_addons for all to authenticated
  using (public.bx_is_sysadmin()) with check (public.bx_is_sysadmin());

create policy charges_select on public.reservation_charges for select to authenticated
  using (public.bx_can_view_reservation(reservation_id));
create policy charges_staff_all on public.reservation_charges for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());

create policy payments_select on public.reservation_payments for select to authenticated
  using (public.bx_can_view_reservation(reservation_id));
create policy payments_staff_all on public.reservation_payments for all to authenticated
  using (public.bx_is_staff()) with check (public.bx_is_staff());

create policy reminders_staff_read on public.reservation_payment_reminders for select to authenticated
  using (public.bx_is_staff());
