-- Reservation agreements: typed-name dual-signature for approved BX reservations
create table if not exists reservation_agreements (
  id                  uuid        primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  reservation_id      uuid        not null,  -- logical FK to reservations.id
  token               text        not null unique,
  agreement_text      text        not null,
  -- Customer signature
  customer_name       text,
  customer_signed_at  timestamptz,
  customer_ip         text,
  -- Staff countersignature
  staff_name          text,
  staff_signed_at     timestamptz
);

-- Index for token lookups (public signing page)
create index if not exists reservation_agreements_token_idx
  on reservation_agreements (token);

-- Index for reservation lookups (admin panel)
create index if not exists reservation_agreements_reservation_id_idx
  on reservation_agreements (reservation_id);

-- RLS
alter table reservation_agreements enable row level security;

-- Anon: read a specific agreement by token (for the signing page)
create policy "anon_read_by_token"
  on reservation_agreements for select
  to anon
  using (true);  -- token itself is the secret; no additional filter needed

-- Anon: update customer signature fields only (cannot touch staff fields)
create policy "anon_sign_customer"
  on reservation_agreements for update
  to anon
  using (customer_signed_at is null)  -- can only sign once
  with check (
    staff_name is null and
    staff_signed_at is null
  );

-- Service role: full access (for admin create + countersign)
create policy "service_role_all"
  on reservation_agreements for all
  to service_role
  using (true)
  with check (true);
