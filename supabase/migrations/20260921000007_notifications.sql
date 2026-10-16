-- ---------------------------------------------------------------------------
-- Notifications — the header dropdown.
--
-- Clinic-wide rather than per-staff-member: the design shows one bell with one
-- list, and every notification in it ("a patient submitted a request") concerns
-- whoever is at the desk rather than one named person. Per-recipient read state
-- would need a join table the UI has nowhere to show.
--
-- Distinct from the Dashboard's Urgent Alerts, which are *derived* from stock
-- and booking state on every read and never stored.
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),

  message text not null,
  -- Where clicking it should go, e.g. '/admin/appointments'.
  href text not null default '',

  read boolean not null default false,
  occurred_at timestamptz not null default now()
);

create index notifications_recent_idx on notifications (occurred_at desc);
create index notifications_unread_idx on notifications (occurred_at desc)
  where not read;

alter table notifications enable row level security;
