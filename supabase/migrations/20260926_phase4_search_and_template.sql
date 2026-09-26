-- Phase 4: bx_settings table for key-value admin configuration (incl. agreement template)
create table if not exists public.bx_settings (
  key   text primary key,
  value text,
  updated_at timestamptz default now(),
  updated_by text
);

-- Seed with placeholder agreement template (admin will replace via UI)
insert into public.bx_settings (key, value) values (
  'agreement_template',
  'FACILITY USE AGREEMENT

BRAINERD BAPTIST CHURCH ("Church") and the undersigned ("Renter") agree to the following terms for use of Church facilities.

EVENT DETAILS
This agreement covers the use of Church facilities as described in the reservation details above.

TERMS AND CONDITIONS

1. USE OF FACILITIES
The Renter agrees to use the facilities only for the event described above and only during the approved time period. The facilities shall not be used for any purpose inconsistent with the mission and values of Brainerd Baptist Church.

2. CARE OF PROPERTY
The Renter agrees to leave all facilities in the same condition in which they were found. The Renter is responsible for all damage to Church property occurring during the rental period.

3. CERTIFICATE OF INSURANCE
Where required, the Renter shall provide a Certificate of Insurance naming Brainerd Baptist Church as an additional insured, with minimum coverage of $1,000,000 per occurrence.

4. ALCOHOL AND SUBSTANCES
No alcoholic beverages or illegal substances are permitted on Church property at any time.

5. NOISE AND NEIGHBORS
The Renter agrees to maintain sound levels appropriate to a church setting and to respect neighboring properties and other Church activities.

6. CANCELLATION
Cancellation requests must be submitted in writing. Cancellation fees may apply depending on the proximity to the event date.

7. INDEMNIFICATION
The Renter agrees to indemnify and hold harmless Brainerd Baptist Church, its officers, employees, and volunteers from any claims, damages, or expenses arising out of Renter''s use of the facilities.

8. AGREEMENT
By typing their full legal name below, the Renter acknowledges that they have read this agreement, understand its terms, and agree to be bound by it. This electronic signature has the same legal effect as a handwritten signature.'
) on conflict (key) do nothing;

-- Indexes for Phase 4 search performance
create index if not exists idx_reservations_status on public.reservations(status);
create index if not exists idx_reservations_created_at on public.reservations(created_at desc);
create index if not exists idx_reservations_contact_name on public.reservations(contact_name);
create index if not exists idx_reservations_contact_org on public.reservations(contact_org);
create index if not exists idx_reservations_event_name on public.reservations(event_name);
create index if not exists idx_reservations_booking_number on public.reservations(booking_number);
