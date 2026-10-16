-- Consultation and scan notes entered by clinic staff for an existing patient.
create table clinical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  occurred_at timestamptz not null,
  title text not null check (length(btrim(title)) > 0),
  findings text not null check (length(btrim(findings)) > 0),
  provider text not null check (length(btrim(provider)) > 0),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index clinical_records_patient_date_idx
  on clinical_records (patient_id, occurred_at desc);

-- Express is the sole data path; the browser's anon key has no table policy.
alter table clinical_records enable row level security;
