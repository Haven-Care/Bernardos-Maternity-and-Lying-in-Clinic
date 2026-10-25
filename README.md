# 🏥 HavenCare

Centralized Management System for **Bernardo's Maternity and Lying-in Clinic**.

| Product | Users | Features |
|---|---|---|
| Staff portal | Staff and administrators | Dashboard, appointments/visits, inventory, patient records, clinic configuration |
| Patient web app | Patients on mobile or desktop | Registration, sign-in, booking, history, cancellation, rescheduling, account settings |

The frontend calls a live Express API backed by Supabase. Database migrations,
seed data, authentication, validation, and automated tests are included.
See [the UI audit](docs/figma-ui-audit.md) for visual acceptance work.

## Run the system

**Start with the [Windows and Linux local setup/testing guide](docs/LOCAL_TESTING.md).**
It covers Node 24, Docker, local Supabase, actual local keys, staff seeding,
the frontend/backend development servers, tests, and troubleshooting.

| Setup | Guide | Database |
|---|---|---|
| Local development and integration tests | [Windows / Linux + Docker](docs/LOCAL_TESTING.md) | Disposable local Supabase containers |
| Local apps with hosted development data | [Hosted Supabase guide](docs/LOCAL_DEVELOPMENT.md) | Shared hosted development project |

Use local Docker for integration tests: they create, update, and delete records.

## Technology

| Layer | Stack |
|---|---|
| Runtime | Node.js **24.x** and npm; `.nvmrc` pins 24 |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7 |
| Backend | Express 5, TypeScript, `tsx watch` for development |
| Data and identity | Supabase PostgreSQL, Auth, and private Storage |
| Checks | ESLint, TypeScript, Vitest, Supertest, SQL assertions, GitHub Actions |

Vite serves the frontend. Express runs as a separate backend process. The
Supabase CLI manages Docker using `supabase/config.toml`; frontend/backend
npm processes run on the host.

## Local addresses

| Service | Address |
|---|---|
| Frontend | <http://localhost:6100> |
| Backend API | <http://localhost:6101/api> |
| API liveness | <http://localhost:6101/api/health> |
| Database readiness | <http://localhost:6101/api/health/db> |
| Supabase API | <http://127.0.0.1:54321> |
| PostgreSQL | `127.0.0.1:54322` |
| Supabase Studio | <http://127.0.0.1:54323> |
| Local test email inbox | <http://127.0.0.1:54324> |

`/health` checks Express. `/health/db` queries the `services` table and returns
HTTP 503 if the configured database cannot be reached.

## Project structure

```text
backend/src/
  config/          # environment and Supabase client
  contract/        # generated copy of frontend API contract types
  controllers/     # API handlers
  db/types.ts      # generated PostgreSQL types
  middleware/      # authentication, authorization, errors, rate limits
  routes/          # domain routes and integration tests
  scripts/         # staff-account provisioning
  app.ts           # Express app and Vercel entry point
  server.ts        # local listening socket
frontend/src/
  api/             # typed backend calls and Supabase Auth operations
  components/      # shared UI, layouts, route guards
  pages/           # booking, patient, auth, and staff pages
  types/           # API contract source
  router.tsx
supabase/
  config.toml
  migrations/
  seed.sql
  templates/       # confirmation and recovery email templates
  tests/           # SQL workflow assertions
scripts/           # contract synchronization
docs/              # local/hosted setup and UI audit
.github/workflows/ # frontend/backend CI
```

## Commands

Run from the repository root containing `frontend/`, `backend/`, and `supabase/`.
On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

| Command | Purpose |
|---|---|
| `npm ci` | Install the locked Supabase CLI tooling |
| `npm --prefix backend ci` | Install backend dependencies |
| `npm --prefix frontend ci` | Install frontend dependencies |
| `npm run db:start` | Start local Supabase containers |
| `npm run db:status` | Display local endpoints and keys |
| `npm run db:reset` | **Erase/rebuild the local database**, then apply migrations and seed |
| `npm run db:stop` | Stop local Supabase and retain data volumes |
| `npm --prefix backend run seed:staff` | Provision staff; use local credentials for tests |
| `npm --prefix backend run dev` | Start Express on port 6101 |
| `npm --prefix frontend run dev` | Start Vite on port 6100 |
| `npm --prefix backend test` | Run backend unit and integration tests |
| `npm --prefix frontend test` | Run frontend tests |
| `npm --prefix backend run lint` | Lint the backend |
| `npm --prefix frontend run lint` | Lint the frontend |
| `npm --prefix backend run build` | Compile backend TypeScript |
| `npm --prefix frontend run build` | Type-check and build the frontend |
| `npm run sync:types:check` | Check frontend/backend API contracts match |
| `npm run sync:types` | Copy frontend contract types to the backend |
| `npm run db:types` | Regenerate database types from local PostgreSQL |

Load [the local environment](docs/LOCAL_TESTING.md#4-load-local-credentials)
before seeding, starting either server, or running backend integration tests.
The root package is not a workspace: install dependencies separately in all
three folders. Both application packages have a `test` script. Database suites
skip when Supabase is unavailable; skipped suites are incomplete verification.

## Environment and API

| Variable | Used by | Local value or source |
|---|---|---|
| `PORT` | Each server | Backend `6101`; frontend `6100` |
| `NODE_ENV` | Backend | `development`, or `test` for tests |
| `CORS_ORIGIN` | Backend | `http://localhost:6100` |
| `SUPABASE_URL` | Backend/tests | `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend/tests | Local CLI `SERVICE_ROLE_KEY`; privileged |
| `SUPABASE_ANON_KEY` | Backend tests | Local CLI `ANON_KEY` |
| `SEED_STAFF_PASSWORD` | Staff seed/tests | Matching local test password |
| `VITE_API_URL` | Frontend | `http://localhost:6101/api` |
| `VITE_SUPABASE_URL` | Frontend | Same Supabase project as the backend |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Local `ANON_KEY`; public browser key |
| `VITE_GOOGLE_LOGIN_ENABLED` | Frontend | `false` until OAuth is configured |

The guide uses terminal-scoped variables so existing hosted `.env` files stay
intact. Every new terminal needs environment initialization. Keep privileged
service-role/secret keys out of `VITE_` variables and version control.

API routes under `/api` cover account/session, staff access, services, slots,
clinic configuration, patients/documents, inventory, bookings, patient-owned
bookings, reschedules, dashboard, and notifications. See [route mounts](backend/src/routes/index.ts),
[shared types](frontend/src/types), and [the API guide](frontend/src/api/README.md).

## Verification

CI runs lint/build/tests and contract synchronization. Backend CI currently
runs without Supabase, so local integration verification is still needed.

The 25 October 2026 local run used Node 24 and Docker: **171 backend tests passed,
none skipped**, and all **77 frontend tests passed**. Both apps passed lint and
build; shared contracts passed synchronization checks. SQL workflow/RLS checks
passed and rolled back test records. This is a dated result, not a guarantee for
later revisions.

Hosted email, OAuth, deployment, and UI acceptance need separate checks. See
[the hosted guide](docs/LOCAL_DEVELOPMENT.md) and [UI audit](docs/figma-ui-audit.md).

## Contributing

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for branch, commit, review, and merge
requirements. Check your branch with `git branch --show-current` before editing.

## 👥 Team

HavenCare Team — UCC Congress Campus, CSE101 System Fundamentals.
Course adviser: Prof. Joemen G. Barrios, MIT.

| Name | Role |
|---|---|
| Bernardo, Edren Vic T. | Research Analysis & QA |
| Dela Cruz, Rain Jehan S. | Backend Developer |
| Escabal, Alexa Margarette A. | Research Analysis & QA |
| Puerta, Hannah B. | Project Manager & Full-Stack Developer |
| Santos, Christian C. | Frontend Developer |
| Seraspe, Ireneo III V. | Backend Developer |
