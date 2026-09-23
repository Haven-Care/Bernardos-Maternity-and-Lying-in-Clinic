-- ---------------------------------------------------------------------------
-- Storage for patient documents.
--
-- Created as a migration rather than clicked into the dashboard, so a fresh
-- checkout has it and the hosted project cannot quietly differ from local.
--
-- `public = false` is the whole point. These are valid IDs, PhilHealth records,
-- lab results and ultrasound reports. A public bucket puts every one of them on
-- a guessable URL with no authentication in front of it — reachable by anyone,
-- indexable by anything. Files are reached only through short-lived signed URLs
-- that Express issues after checking the caller is staff.
--
-- There are no storage.objects policies, matching the posture on every other
-- table: the anon key in the browser cannot list, read or write this bucket.
-- Express holds service_role and is the only way in.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  -- 10 MB. Comfortably fits a scanned ID or an ultrasound image, and small
  -- enough that a stray upload cannot fill the disk.
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
