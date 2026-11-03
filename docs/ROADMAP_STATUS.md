# Production roadmap status

Where the production-readiness work stands: what is done, what is still open, and what was written but never verified. **Update this file whenever a phase lands or an item here is closed.**

Last updated: 3 November 2026 (backend Preview health and access log seen on Vercel; four-role model decided; the clinic owner acts for the clinic).

Since 3 Nov 2026 this work lands on `dev`, the development branch. `dev` took over from `deployment/prep`, which is left in place at ac564d6 and no longer used. Nothing merges into `main` until the team decides to; the flow is in `CONTRIBUTING.md`.

Steps that need a person (dashboard settings, accounts, decisions and questions for the clinic) are collected, by service, in `OPERATOR_TODO.md`.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Accounts, billing, contract, domain, Brevo, DPO | Not started. Team and clinic decisions, no code |
| 1 | Environment guard-rails | Done (37f2a8c) |
| 2 | Security hardening | Core done (11a7e53, migration 26). Open items below |
| 3 | Data Privacy Act: consent, audit log, privacy requests | Done (eb7baa7, migration 27). Notice text and DPO await the clinic |
| 4 | Reliability: paging, shared rate limits, timeouts, load test | Code landed (e493798). Unverified items below |
| 5 | Operations: monitoring, backups, CI integration job, releases | In progress. CI integration job and CI hardening green on GitHub; access log, nightly notification purge, error boundary and release process written. Monitoring and backups need accounts, see below |

## Check first

- **Resolved:** backend deploys failed from 11a7e53 to eb7baa7, so Phases 2 and 3 never reached a backend deployment. Vercel's build type-check resolved helmet's CommonJS typings, where `helmet()` is not callable. Fixed in 0e6ff3f (`backend/src/middleware/securityHeaders.ts`). On 2 Nov 2026, `/api/health` and `/api/health/db` both returned 200 on the 020fa8f `havencare-backend` Preview, so the Phase 2 start-up checks pass on Vercel.
- **Migrations 26, 27 and 28 are not applied to any hosted project.** After applying them to staging, mark it as a demo database; see "After migration 26 reaches staging" in `PRODUCTION_CONFIG.md`.

## Phases 1–3: not verified, or waiting on someone else

**Couldn't run or see on the development machine**
- [ ] Migrations 26–28 run on every push in the CI integration job, against a local Supabase stack with real `auth`, `storage` and roles (green since 02ec77b). They have never been applied to a hosted project. A read-only check of staging found nothing that should stop them: the same seven unpinned functions, all owned by `postgres`; no storage policies; both views `security_invoker`. Staging also serves the production URL, which runs `main`. Decided 3 Nov 2026: leave staging alone until the production project exists and staging no longer serves the live site. After applying them, run the Supabase advisors and `select assert_rls_posture();`.
- [x] `backend/src/db/types.ts` was edited by hand for migrations 26 and 27. The integration job now regenerates it from the migrated stack and fails on any difference. Its first run (020fa8f) caught one hand-edit mistake: `audit_log.id` is `generated always`, so it is `never` on insert and update, not `number`. It also caught two generator differences: no `__InternalSupabase` block from a local stack, and a final blank line. The file is now byte-for-byte what CI generated. If the check fails again, the diff is in the job's annotation, which `api.github.com/repos/<owner>/<repo>/check-runs/<id>/annotations` returns without signing in.
- [ ] Screens that need a signed-in user were checked only by unit tests:
  - the consent screen, and Profile → Your Privacy
  - System Access → Activity Log and Privacy Requests
  - Export record
  - the administrator-only Administration tabs
  - idle sign-out after 20 minutes, and the redirect when a session expires

  Click through them on staging.
- [ ] The CSP was checked against a local build with Google sign-in switched off. Decided 3 Nov 2026: Google sign-in ships at launch, with a clinic-owned Google client (`OPERATOR_TODO.md` → Google sign-in). Check it under the CSP before setting `VITE_GOOGLE_LOGIN_ENABLED=true`.
- [x] CI on `deployment/prep`: Backend CI, Frontend CI and Database integration were all green on 02ec77b (2 Nov 2026). Read through the public GitHub API; `gh` is not signed in on the development machine, and job logs need a signed-in account.
- [ ] `npm run sync:types:check` fails on Windows checkouts because of line endings. It passes on Linux CI, and the committed copies match. This is not contract drift; fix it only if it gets in someone's way.

**Needs a dashboard, an account, or the clinic**
- [ ] None of the hosted Auth settings in `PRODUCTION_CONFIG.md` are applied anywhere yet:
  - leaked-password protection is still off; Supabase's advisor flags it
  - the minimum password length has not been raised to 12 to match the app
  - no custom SMTP
  - OTP expiry and email rate are unchanged
  - redirect URLs are not narrowed
  - no session timeouts

  CAPTCHA waits for the Turnstile item under Phase 2.
- [ ] The staging secret key has not been rotated, although it was shared on lab and shared computers.
- [ ] Before Preview deployments point at staging, `frontend/src/lib/apiBase.ts` must honour a Preview API URL. Today every `*.vercel.app` host goes to the production backend through the rewrite. This was held back on purpose: Vercel sets `VITE_API_URL` for Production too, so changing it early could switch production to cross-origin calls.
- [ ] `frontend/vercel.json` allows any `https://*.supabase.co` origin in its CSP. Narrow it to the real project origins once production exists.
- [ ] Dependabot does nothing until `.github/dependabot.yml` is on the default branch (`main`).
- [ ] The clinic has to:
  - approve the privacy notice. The clinic has no legal adviser or DPO, so the owner decides and is the team's contact
  - name its DPO, someone already at the clinic
  - set its medical-record retention period under DOH rules
  - check whether it must register with the National Privacy Commission
  - confirm the draft breach procedure in `RUNBOOK.md`
- [ ] Once migration 27 deploys, the staging demo patients (`client01`–`client05`) see the consent screen on their next sign-in, and their bookings return 428 until they agree. Expect it in demos.

**Done on staging outside the repository**
- 2 Nov 2026: the seed-script accounts `hannahp@havencare.ph` (administrator) and `staff@havencare.ph` were set inactive on staging, because their password may be the one published in `docs/LOCAL_TESTING.md`. `berndo.clinic@gmail.com` and `havencare.org@gmail.com` remain the active administrators. Reactivate either account from System Access only after giving it a private password.

## Phase 4: not verified, or still to do

**Couldn't run on the development machine**
- [x] The database integration suites ran green against the Phase 2–4 changes in the CI integration job on 02ec77b, with `REQUIRE_DB=1`, so none of them skipped. That covers the test-helper changes for booking limits, ordered clean-up and the consent tick in `signUpPatient`. The test count is in the job log, which needs a signed-in account.
- [ ] Paging has not been checked in a browser. It needs the new backend and a database.
- [ ] The k6 load test (`scripts/load/booking-load.js`) has only been syntax-checked. Install k6 and follow `LOAD_TESTING.md`.

**Needs an account, a deploy, or staging data**
- [ ] Create an Upstash Redis database. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the backend in Vercel. Until then, rate limits count per serverless instance.
- [ ] The Upstash store has been tested only against a mocked `/multi-exec` reply. After the variables are set, watch one rate-limited response on staging and confirm the `RateLimit` header counts down.
- [ ] Check that the backend sees visitors' real addresses through the frontend's `/api` rewrite. The two-network check is in `PRODUCTION_CONFIG.md`.
- [ ] Create 3–10 confirmed test patient accounts on staging for the load test, then run it and record the results in `RUNBOOK.md`.

**Left out on purpose**
- `maxDuration` is not set in `backend/vercel.json`. The function path for Vercel's Express preset could not be confirmed, and a wrong path fails the build. Every Supabase call already times out after 10 s. `PRODUCTION_CONFIG.md` says how to add it safely.
- Server-side search and a `pg_trgm` index were skipped. The screens filter complete lists in the browser, which is fine at this clinic's size. Revisit if a list passes about 10,000 rows.
- The administrator privacy-request list (`listPrivacyRequests` in `privacy.controller.ts`) still stops at 500 rows.

## Phase 2: still open

- [ ] TOTP two-factor sign-in, enforced in the API (`aal2`) for administrators and the super administrator (decided 3 Nov 2026; staff and the owner are not required), plus a reset by the super administrator. Build it with the roles below.
- [ ] The current password required before a staff member changes their email.
- [ ] Turnstile CAPTCHA on sign-up, login and password reset.
- [x] Password minimum of 12 characters: `PASSWORD_MIN_LENGTH` in `frontend/src/lib/password.ts` (sign-up, reset, change, and the staff form in System Access), `createStaffSchema` in `backend/src/services/staff.ts`, and `minimum_password_length` in `supabase/config.toml` for local stacks. Existing accounts with shorter passwords still sign in. The hosted Auth setting is part of the hosted Auth item under Phases 1–3.
- [ ] Smaller database items left from the Phase 2 plan; migration 26 covers the rest:
  - archive a patient (`patients.archived_at`) instead of deleting the row
  - CHECK constraints: date of birth not in the future, and length caps on free text
  - refusing bookings on clinic holidays needs a calendar of holiday dates first; today `operating_hours` has a `holidays` row for hours only
- [ ] Roles, decided 3 Nov 2026; not built yet. Today an administrator sees everything a staff member sees, patient records included.
  - **Patient:** unchanged.
  - **Staff (the clinic):** all of the clinic's work: appointments, patient records and documents, dashboard and notifications, inventory, prices, hours, slots, clinic details, and answering privacy requests.
  - **Owner:** exactly one account, assigned by the super administrator. Everything staff do, plus the activity log and creating and deactivating staff accounts.
  - **Administrator (the HavenCare team):** edits prices, hours, slots and clinic details. No patient data, no inventory, no staff accounts.
  - **Super administrator:** everything; one named operator. An app role, so every record opened is in the activity log. Creates administrator and staff accounts and assigns the one owner. Itself set up directly in the database, never from the app.
  - **Two-factor sign-in** is required for administrators and the super administrator; not for staff or the owner.
  - When this lands, update the containment step in `RUNBOOK.md`: the owner or the super administrator deactivates a compromised staff account, because administrators no longer can.

## Phase 5: in progress

**Written, not verified**
- [x] `.github/workflows/db-integration.yml` starts a local Supabase stack and runs `supabase/tests/*.sql`, `assert_rls_posture()` and the backend suites with `REQUIRE_DB=1`. It uses the Supabase CLI from the root `package-lock.json` (2.117.0), not `latest`, which is now a new major version (3.0.0). First run green on 02ec77b: about 3 minutes, 72 s of it starting the stack. Making it a required check needs a repository admin (see Still to do).
- [x] `backend/src/middleware/accessLog.ts` logs one JSON line per request (route pattern, status, duration, request id; no path values, query or body). Seen in Vercel's runtime logs on the 020fa8f Preview on 2 Nov 2026, next to the start-up warning that Upstash is not set. The Hobby plan keeps runtime logs for one hour only.
- [x] CI hardening: every workflow has `permissions: contents: read` and pins its actions to commit SHAs, the stale `feat/backend-clinic-workflows` triggers are gone, and Backend CI and Frontend CI run `npm audit --omit=dev --audit-level=high`. Green on GitHub on 02ec77b, both audit steps included. That run warned that the v4 actions target the deprecated Node.js 20, so the pins moved to `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0, which run on Node.js 24. All three workflows passed those steps on 020fa8f.
- [ ] Migration 28 schedules `purge_expired_notifications()` nightly with pg_cron (19:00 UTC, 03:00 Manila). PGlite has no pg_cron, so `npm run db:check` exercises only the branch that skips scheduling. `supabase/tests/notification_purge.sql` now skips only where pg_cron is unavailable, as the migration does, so on a Supabase stack a missing job fails. The SQL tests passed on 020fa8f with the stricter test. Supabase's Postgres image ships pg_cron, so the test checked the job instead of skipping; the job log, which needs a signed-in account, would show a skip notice otherwise. After applying it to staging, check `cron.job` and, the next day, `cron.job_run_details`. The query is in `RUNBOOK.md`.
- [x] `frontend/src/components/AppErrorBoundary.tsx` wraps the app, so an error outside the router shows a recovery screen instead of a blank page. Unit-tested, and checked in the local preview with a forced crash.

**Still to do (most need an account or the clinic)**
- Sentry error tracking (needs a Sentry account and DSN). React 19 and React Router 7 already log caught render errors to the console, which is why `RouteError` does not log them again. Report them from `createRoot`'s `onCaughtError` and `onUncaughtError` (`frontend/src/main.tsx`), and add the Sentry ingest origin to `connect-src` in `frontend/vercel.json`.
- Uptime monitoring on `/api/health` and `/api/health/db`.
- Encrypted off-site backups and a restore drill (needs a storage account and decision on where). Fix or retire `scripts/backup-supabase.mjs` at the same time: it writes unencrypted files and takes its table list from `backend/src/db/types.ts`, so a table missing there is silently left out.
- Purging medical records waits for the clinic's retention period (see the Phase 3 items). Notifications are purged nightly by migration 28.
- The release process is in `RUNBOOK.md` → Releases. Once the production project exists, consider running `supabase db push` from a GitHub Environment `production` with required approval instead of an operator's computer.
- Needs a repository admin:
  - Protect `main` with a ruleset: pull request required, plus Backend CI, Frontend CI and Database integration as required checks. Steps in `OPERATOR_TODO.md` → GitHub. `dev` stays unprotected (decided 3 Nov 2026).
  - Confirm secret scanning and push protection are on (Settings → Code security).

## Notes for whoever picks this up

- On a machine without Docker, the database suites skip instead of failing. Check migrations with `npm run db:check` instead (run `npm ci --ignore-scripts` at the repo root once). It applies every migration, the seed and `supabase/tests/*.sql` to an in-memory Postgres with stub `auth` and `storage` schemas. It does not test GoTrue, PostgREST, Storage or a hosted project's grants, so apply migrations to a local stack or staging before trusting them fully. Backend CI runs the same check on every push to, and pull request into, the branches it watches.
- Phase 0: the hosting prices in the plan came from third-party sites. Confirm them on the Supabase, Vercel and Brevo pricing pages before quoting the clinic.
- The staging Supabase project (`camqzzctawwqlwmqqpop`) and the Vercel team are on free plans and hold demo data only. See `PRODUCTION_CONFIG.md` before changing either.
