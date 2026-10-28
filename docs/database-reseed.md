# Backing up and reseeding the demonstration environment

`private-backups/` and `private-seeds/` are ignored by Git. Keep directories mode 700 and exports/credentials mode 600. Backups contain private application records. Never upload them to source control.

The backup tool exports every generated public table, paginated Auth account metadata, storage buckets/files, and schema references. `supabase/backup-data.sql` adds an atomic public-data snapshot plus hosted schema definitions. Save its `backup` result as `public-snapshot.json` in the backup directory, verify table counts, and add the file's SHA-256 digest to `manifest.json` before planning a reset. Password hashes, sessions, and refresh tokens are excluded. This is a logical backup, not a complete PostgreSQL cluster backup; restoring it has not been rehearsed.

```sh
npm run db:backup:project -- private-backups/UNIQUE_DIRECTORY
```

The reseed tool uses that checked snapshot, the configured Supabase project, an explicit matching project ref, and a private credential file containing `SEED_ADMIN_PASSWORD` and `SEED_CLIENT_PASSWORD`. Passwords have no source-code defaults. Its only account targets are the two administrators and five `client01`–`client05` demo addresses in the plan. Those accounts must already exist in the correct realm. Other Auth users, staff profiles, and patient account profiles are retained.

```sh
npm run db:reseed:demo -- plan BACKUP_DIRECTORY PLAN_JSON CREDENTIALS_ENV PROJECT_REF
```

Review the private plan and SQL, and rehearse the SQL against a disposable migrated database containing the backed-up application rows. Planning does not change the hosted database. Applying requires explicit authorization to reset demonstration data.

```sh
npm run db:reseed:demo -- apply BACKUP_DIRECTORY PLAN_JSON CREDENTIALS_ENV PROJECT_REF
```

Apply updates only the seven allowlisted credentials, then replaces operational data in one database transaction. It locks and compares operational and clinic master tables to the backup; any intervening changes abort the reset. Account provisioning is an Auth API operation outside that transaction and may already have completed if the database operation fails.

The reset creates five synthetic patient records, thirty bookings, ten consultation notes, three reschedule requests, and a batch-based inventory with reconciled receipt/dispensing/disposal history. Future bookings use `book_appointment` and reserve actual capacity. Past visits and notes are explicitly synthetic history. Completed/no-show appointments remain in the past. Booked is stored as `pending`; no confirmation step is seeded.

Services/prices/activation, clinic information/settings, hours, and appointment slots are preserved exactly. Inventory uses the curated medicine catalogue from `supabase/seed.sql` with dates relative to the clinic day. Old operational records remain in the saved backup, not in the reset application's history.

Apply verifies all seven logins against Auth and the deployed API, administrator/patient routing, six bookings per client, booking isolation, cross-realm access rejection, and preservation of clinic master data. Tokens are never written to the report. A separate verification run is available:

```sh
npm run db:reseed:demo -- verify BACKUP_DIRECTORY PLAN_JSON CREDENTIALS_ENV PROJECT_REF
```

Do not repeat `apply` against its original backup after a successful reset. The stale-backup guard will reject it. Create a fresh backup and plan for a later authorized reset.
