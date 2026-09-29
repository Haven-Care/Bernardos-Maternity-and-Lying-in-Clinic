-- ---------------------------------------------------------------------------
-- Inventory: medicines, the batches that hold their stock, and the movement log.
--
-- The shape that matters: a medicine has no quantity and no expiry. Its batches
-- do. The Expiration Tracker lists Batch No. and Days Left per row, so one
-- medicine holds several lots expiring on different dates — "200 units expiring
-- Nov 3, 150 expiring Jan 20" is exactly what the clinic needs to see, and a
-- flat quantity column cannot say it.
--
-- Quantity is never written directly either. It moves only through a recorded
-- stock-in or stock-out, which is what separates medicine *used* from medicine
-- *wasted*. The log is the feature, not a side effect of it.
-- ---------------------------------------------------------------------------

create table medicines (
  id uuid primary key default gen_random_uuid(),

  -- Basic Medicine Details
  generic_name text not null,
  brand_name text not null default '',
  -- Free text, not an enum: the observed values (Analgesic, Antibiotic,
  -- Supplement, Antiseptic) are the filter's options, and the contract leaves
  -- the union open. Note that "All Categories" is a *filter* value and must
  -- never be stored on a record — a medicine cannot be all categories.
  category text not null default '',
  dosage_form dosage_form not null,
  dosage text not null default '',
  -- Also open: pcs, Boxes, Bottles, Vials, and whatever the clinic adds.
  unit text not null default 'pcs',

  -- Inventory & Stock Tracking. Low Stock compares total on-hand against this.
  reorder_level integer not null default 0 check (reorder_level >= 0),

  -- Pricing & Financials
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  selling_price numeric(10, 2) not null default 0 check (selling_price >= 0),

  -- Storage & Supplier Info
  supplier_name text not null default '',
  supplier_contact text not null default '',
  storage_location text not null default '',

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger medicines_set_updated_at
  before update on medicines
  for each row execute function set_updated_at();

create index medicines_active_idx on medicines (active) where active;

-- ---------------------------------------------------------------------------
-- Batches
--
-- `quantity >= 0` is the constraint that makes an over-draw impossible at the
-- storage layer, underneath whatever the application believes. record_stock_out
-- checks first and returns a readable error; this is what catches the case
-- where two dispensals race and both pass their own check.
-- ---------------------------------------------------------------------------
create table medicine_batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines (id) on delete cascade,

  batch_no text not null,
  quantity integer not null default 0 check (quantity >= 0),
  expires_at date not null,
  received_at date not null default clinic_today(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Two lots of the same medicine cannot share a batch number; a repeat
  -- stock-in of the same batch tops up the existing row.
  unique (medicine_id, batch_no)
);

create trigger medicine_batches_set_updated_at
  before update on medicine_batches
  for each row execute function set_updated_at();

-- Expiration Tracker reads live batches in expiry order.
create index medicine_batches_expiry_idx
  on medicine_batches (expires_at)
  where quantity > 0;

create index medicine_batches_medicine_idx on medicine_batches (medicine_id);

-- ---------------------------------------------------------------------------
-- Stock movements — the audit trail
--
-- `on delete restrict` on both references is deliberate. A batch or medicine
-- with movements behind it cannot be deleted, because deleting it would erase
-- the record of stock that was genuinely dispensed or disposed of. Medicines
-- are deactivated instead.
-- ---------------------------------------------------------------------------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null references medicine_batches (id) on delete restrict,
  medicine_id uuid not null references medicines (id) on delete restrict,

  type stock_movement_type not null,
  quantity integer not null check (quantity > 0),

  -- Record Stock Out captures a reason: Dispensed to patient, Expired /
  -- Disposed, or Damaged. That distinction is the whole point of the log.
  note text not null default '',

  occurred_at timestamptz not null default now(),
  -- Survives the staff member leaving.
  created_by uuid references profiles (id) on delete set null
);

create index stock_movements_recent_idx on stock_movements (occurred_at desc);
create index stock_movements_medicine_idx
  on stock_movements (medicine_id, occurred_at desc);

alter table medicines enable row level security;
alter table medicine_batches enable row level security;
alter table stock_movements enable row level security;
