-- ---------------------------------------------------------------------------
-- Patients: the clinical record, and the documents attached to it.
--
-- Created at a patient's first booking, not at sign-up — see patient_accounts.
-- A booking supplies only name, contact number and email, so every other field
-- starts empty and staff complete it at the visit.
--
-- That is why `date_of_birth`, `sex` and `civil_status` are nullable here even
-- though a finished record has all three. Text fields default to '' instead, so
-- the contract can keep typing them as plain strings.
--
-- `last_visit` is deliberately absent: it is derived from the most recent
-- completed appointment, and lives in the patient_list view.
-- ---------------------------------------------------------------------------

create table patients (
  id uuid primary key default gen_random_uuid(),
  patient_code text not null unique
    default 'P-' || lpad(nextval('patient_code_seq')::text, 3, '0'),

  -- Null for walk-ins, who are registered at the desk and may never hold an
  -- account. The app adds a channel; it does not remove the counter.
  account_id uuid unique references patient_accounts (id) on delete set null,

  -- Personal Information
  full_name text not null,
  date_of_birth date,
  sex sex,
  civil_status civil_status,
  contact_number text not null default '',
  email text not null default '',
  address text not null default '',
  occupation text not null default '',
  blood_type blood_type,
  emergency_contact_name text not null default '',
  emergency_contact_number text not null default '',
  emergency_contact_relation text not null default '',

  -- Maternity & Medical Info
  last_menstrual_period date,
  expected_delivery_date date,
  -- Number of pregnancies, and births carried to viability. Para can never
  -- exceed gravida.
  gravida integer check (gravida >= 0),
  para integer check (para >= 0),
  constraint patients_para_within_gravida check (
    gravida is null or para is null or para <= gravida
  ),
  attending_physician text not null default '',
  allergies text not null default '',
  medical_conditions text not null default '',
  visit_type visit_type,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger patients_set_updated_at
  before update on patients
  for each row execute function set_updated_at();

create index patients_full_name_idx on patients (lower(full_name));

-- ---------------------------------------------------------------------------
-- Patient documents
--
-- Metadata only. The files themselves live in a private Storage bucket and are
-- reachable exclusively through short-lived signed URLs — these are medical
-- records, and a public bucket would put them on the open internet.
-- ---------------------------------------------------------------------------
create table patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,

  doc_type patient_document_type not null,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),

  -- Object key within the `patient-documents` bucket. Unique so two rows can
  -- never claim the same object and a delete can never orphan another's file.
  storage_path text not null unique,

  uploaded_at timestamptz not null default now(),
  -- Kept on delete so the audit trail survives a staff member leaving.
  uploaded_by uuid references profiles (id) on delete set null
);

create index patient_documents_patient_idx
  on patient_documents (patient_id, uploaded_at desc);

alter table patients enable row level security;
alter table patient_documents enable row level security;
