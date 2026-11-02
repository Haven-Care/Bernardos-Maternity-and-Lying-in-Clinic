# Production roadmap status

Where the production-readiness work stands: what is done, what is still open, and what was written but never verified. **Update this file whenever a phase lands or an item here is closed.**

Last updated: 2 November 2026.

All of this work branches from and targets `deployment/prep`. Nothing merges into `main` until the team decides to.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Accounts, billing, contract, domain, Brevo, DPO | Not started. Team and clinic decisions, no code |
| 1 | Environment guard-rails | Done (37f2a8c) |
| 2 | Security hardening | Core done (11a7e53, migration 26). Open items below |
| 3 | Data Privacy Act: consent, audit log, privacy requests | Done (eb7baa7, migration 27). Notice text and DPO await the clinic |
| 4 | Reliability: paging, shared rate limits, timeouts, load test | Code landed (e493798). Unverified items below |
| 5 | Operations: monitoring, backups, CI integration job, releases | Not started |

## Check first

- **Backend deploys failed from 11a7e53 to eb7baa7.** Vercel's build type-check resolved helmet's CommonJS typings, where `helmet()` is not callable, so Phases 2 and 3 never reached a backend deployment. Fixed in 0e6ff3f (`backend/src/middleware/securityHeaders.ts`); the e493798 Preview built and deployed on 2 Nov 2026. Its responses have not been checked, because Previews sit behind Vercel Authentication. Signed in to Vercel, open `/api/health` and `/api/health/db` on the latest `havencare-backend` Preview. This is the first time the Phase 2 start-up checks run on Vercel. For example, `CORS_ORIGIN` is required when `NODE_ENV=production`.
- **Migrations 26 and 27 are not applied to any hosted project.** After applying them to staging, mark it as a demo database; see "After migration 26 reaches staging" in `PRODUCTION_CONFIG.md`.

## Phases 1–3: not verified, or waiting on someone else

**Couldn't run or see on the development machine**
- [ ] Migrations 26 and 27 have only run in PGlite (`npm run db:check`), with stub `auth` and `storage` schemas. A read-only check of staging found nothing that should stop them: the same seven unpinned functions, all owned by `postgres`; no storage policies; both views `security_invoker`. They have still never been applied to a real Supabase database. After applying them to staging, run the Supabase advisors and `select assert_rls_posture();`.
- [ ] `backend/src/db/types.ts` was edited by hand for migrations 26 and 27. Regenerate it with `npm run db:types` from a local stack and check that the diff is empty.
- [ ] Screens that need a signed-in user were checked only by unit tests:
  - the consent screen, and Profile → Your Privacy
  - System Access → Activity Log and Privacy Requests
  - Export record
  - the administrator-only Administration tabs
  - idle sign-out after 20 minutes, and the redirect when a session expires

  Click through them on staging.
- [ ] The CSP was checked against a local build with Google sign-in switched off. Check Google sign-in under the CSP on staging before setting `VITE_GOOGLE_LOGIN_ENABLED=true`.
- [ ] Nobody has looked at CI results for `deployment/prep`: `gh` is not signed in on the development machine. Confirm both workflows are green on GitHub.
- [ ] `npm run sync:types:check` fails on Windows checkouts because of line endings. It passes on Linux CI, and the committed copies match. This is not contract drift; fix it only if it gets in someone's way.

**Needs a dashboard, an account, or the clinic**
- [ ] None of the hosted Auth settings in `PRODUCTION_CONFIG.md` are applied anywhere yet:
  - leaked-password protection is still off; Supabase's advisor flags it
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
  - approve the privacy notice with its legal adviser
  - name its DPO
  - set its medical-record retention period under DOH rules
  - check whether it must register with the National Privacy Commission
  - confirm the draft breach procedure in `RUNBOOK.md`
- [ ] Once migration 27 deploys, the staging demo patients (`client01`–`client05`) see the consent screen on their next sign-in, and their bookings return 428 until they agree. Expect it in demos.

**Done on staging outside the repository**
- 2 Nov 2026: the seed-script accounts `hannahp@havencare.ph` (administrator) and `staff@havencare.ph` were set inactive on staging, because their password may be the one published in `docs/LOCAL_TESTING.md`. `berndo.clinic@gmail.com` and `havencare.org@gmail.com` remain the active administrators. Reactivate either account from System Access only after giving it a private password.

## Phase 4: not verified, or still to do

**Couldn't run on the development machine**
- [ ] The database integration suites (116 tests) have not run against the Phase 2, 3 or 4 changes. That includes the test-helper changes for booking limits, ordered clean-up and the consent tick in `signUpPatient`. They need a local Supabase stack, which needs Docker. Run them on a machine with Docker, or in the Phase 5 CI integration job.
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

- [ ] Staff TOTP MFA, enforced in the API (`aal2`), plus an administrator reset.
- [ ] The current password required before a staff member changes their email.
- [ ] Turnstile CAPTCHA on sign-up, login and password reset.
- [ ] Password minimum of 12 characters, in the UI and the hosted Auth setting together. `backend/src/services/staff.ts` still accepts 8.
- [ ] Smaller database items from the Phase 2 plan.

## Phase 5: not started

Sentry error tracking, structured logs, uptime monitoring, encrypted off-site backups with a restore drill, a scheduled purge job, a CI job that runs the database suites, and a documented release process.

## Notes for whoever picks this up

- On a machine without Docker, the database suites skip instead of failing. Check migrations with `npm run db:check` instead (run `npm ci --ignore-scripts` at the repo root once). It applies every migration, the seed and `supabase/tests/*.sql` to an in-memory Postgres with stub `auth` and `storage` schemas. It does not test GoTrue, PostgREST, Storage or a hosted project's grants, so apply migrations to a local stack or staging before trusting them fully. Backend CI runs the same check on every push to, and pull request into, the branches it watches.
- Phase 0: the hosting prices in the plan came from third-party sites. Confirm them on the Supabase, Vercel and Brevo pricing pages before quoting the clinic.
- The staging Supabase project (`camqzzctawwqlwmqqpop`) and the Vercel team are on free plans and hold demo data only. See `PRODUCTION_CONFIG.md` before changing either.
