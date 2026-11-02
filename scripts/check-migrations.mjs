// Applies every migration, the seed and the SQL tests to a throwaway in-memory
// Postgres (PGlite), without Docker or a Supabase project.
//
//   npm run db:check                                      # all of supabase/tests/
//   npm run db:check -- supabase/tests/privacy_records.sql
//
// Install first with `npm ci --ignore-scripts` at the repo root; the Supabase
// CLI binary is not needed for this.
//
// What it proves: the migrations apply in order on Postgres 17, the seed loads,
// and each SQL test's assertions hold, including assert_rls_posture().
// What it does not: Supabase's own services (GoTrue, PostgREST, Storage),
// extensions, and the exact roles and grants of a hosted project. The `auth`
// and `storage` schemas below are stubs with only the columns these
// migrations touch. Apply to a local stack or staging before trusting a
// migration fully.

import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrations = join(root, 'supabase/migrations')
const tests = join(root, 'supabase/tests')

// What Supabase has in place before the first migration runs, reduced to what
// these migrations use, including its default grants to the browser-key roles.
// Keeping those grants is what lets migration 26's revoke, and the posture
// check, be tested at all.
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
);
`

const label = (file) => relative(root, file).split(sep).join('/')
const sqlFiles = async (dir) => (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort().map((name) => join(dir, name))

const requested = process.argv.slice(2).map((path) => resolve(root, path))
const steps = [
  ['Supabase stubs', null],
  ...(await sqlFiles(migrations)).map((file) => [label(file), file]),
  ['supabase/seed.sql', join(root, 'supabase/seed.sql')],
  ...(requested.length ? requested : await sqlFiles(tests)).map((file) => [label(file), file]),
]

const db = new PGlite()
let failed = false
try {
  for (const [name, file] of steps) {
    try {
      await db.exec(file ? await readFile(file, 'utf8') : SUPABASE_STUBS)
      console.log(`ok    ${name}`)
    } catch (error) {
      console.error(`FAIL  ${name}\n      ${error.message}`)
      failed = true
      // Later steps depend on this one; their failures would only be noise.
      break
    }
  }
} finally {
  await db.close()
}

process.exitCode = failed ? 1 : 0
