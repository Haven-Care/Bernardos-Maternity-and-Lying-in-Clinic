# Production configuration checklist

HavenCare will hold real patient health data for Bernardo's Maternity and
Lying-in Clinic. That data is sensitive personal information under RA 10173,
the Data Privacy Act. This file records how hosted environments are separated,
who holds which keys, and every hosted setting that `supabase/config.toml` does
**not** control. Update it in the same pull request as any change to those
settings.

## Environments

| Environment | Supabase | Vercel | Data | Who holds the secret key |
|---|---|---|---|---|
| Local | `supabase start` (Docker) | `npm run dev` | Disposable seed data | Everyone (local demo key) |
| Staging | `camqzzctawwqlwmqqpop`, free org "HavenCare" | **Preview** environment of `havencare-frontend` and `havencare-backend` | Demonstration data only | Team developers |
| Production | New project in a separate org whose billing the clinic owns | **Production** environment of the same two projects | Real patients | Vercel Production env plus two named operators |

**Current state (verified 2 Nov 2026):**

- **Supabase:** there is no production project yet.
  - `camqzzctawwqlwmqqpop` serves local-hosted development, the demo, and the production URL.
  - The org is on the **free** plan: no automatic backups, and the project can pause when idle.
  - Region is `ap-southeast-1` (Singapore), matching the backend's Vercel region `sin1`.
  - Hosted migration history matches the repository's migrations.
- **Vercel:** team "Havencare" is on the **Hobby** plan. Production and Preview share the same Supabase variables.

## Never do this

- **Never run `supabase config push` against a hosted project.** `config.toml`
  holds localhost URLs and local-only Auth values, and would overwrite the
  hosted settings below.
- **Never run `supabase db reset --linked`.** It erases the hosted database and
  runs `seed.sql`. Production gets migrations only.
- **Never copy a production key into a `.env` file, a chat, or a VITE_ variable.**
- **Never add a production ref to `DEMO_PROJECT_REFS`** (`scripts/demo-seed-plan.mjs`).
  The demo reset truncates every patient table.

Repository guard-rails that enforce part of this:

| Tool | Guard |
|---|---|
| Backend integration suites (`backend/src/test/stack.ts`) | Run only against a local stack. With `REQUIRE_DB=1` they fail instead of skipping |
| `npm --prefix backend run seed:staff` | Refuses hosted projects unless `-- --allow-hosted` is passed. On a hosted project, also refuses the documented development password |
| `npm run db:reseed:demo` | Refuses any ref outside `DEMO_PROJECT_REFS`. Resets only accounts that carry the demo-seed marker. Verifies against `HAVENCARE_API_URL` |
| `npm --prefix backend run create:admin` | Requires `--project-ref` to match `SUPABASE_URL`, and a private password of 12 or more characters |
| Clinical tables (migration 26) | `TRUNCATE` on patients, clinical records, documents, appointments and their status history is refused unless `private.deployment.environment = 'demo'`. Deleting a patient or booking that has records or history is refused |
| Browser keys (migration 26) | `anon` and `authenticated` hold no table privileges; `assert_rls_posture()` checks this on every migration |
| Privacy records (migration 27) | Consents and the audit log cannot be edited or deleted; the audit log refuses `TRUNCATE` outside a demo database |

**After migration 26 reaches staging**, mark staging as a demonstration database once, in its SQL editor, before the next demo reset:

```sql
update private.deployment set environment = 'demo';
```

New projects start as `production`. Never run this on the clinic's project. The local `seed.sql` marks local databases itself.

## Creating the production project

1. **Create the organization and project.**
   - Create a new Supabase organization. The clinic is billing owner; team operators are members.
   - Create the project in **Southeast Asia (Singapore)**.
   - Store the database password in the team's password manager, not in a file.
2. **Apply migrations only.** Do not run the seed.
   ```bash
   npx supabase link --project-ref <prod-ref>
   npx supabase db push
   npx supabase migration list --linked
   ```
   Every local migration must show as applied remotely.
3. **Apply the hosted settings below**, then run the security advisors (Dashboard → Advisors). The remaining expected INFO is "RLS enabled, no policy": access goes through Express only.
4. **Create the first administrator** from a trusted computer.
   - Set the production keys in the terminal session only, never in `backend/.env`.
   - Run:
     ```bash
     ADMIN_EMAIL=… ADMIN_FULL_NAME=… ADMIN_PASSWORD=… \
       SUPABASE_URL=https://<prod-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
       npm --prefix backend run create:admin -- --project-ref <prod-ref>
     ```
   - Close the terminal afterwards. That administrator creates the other staff accounts from **System Access**.
5. **Upgrade the organization to Pro before the first real patient.** This turns on daily backups and stops the project pausing.

## Hosted Auth settings

These are set in the Supabase dashboard for **each** hosted project. Only some
of them have a `config.toml` counterpart, and that file applies to local
Docker only.

| Setting | Where | Staging | Production |
|---|---|---|---|
| Site URL | Authentication → URL Configuration | Staging frontend URL | Clinic domain (the current production URL until one is bought) |
| Redirect URLs | Same page | `<staging origin>/auth/callback` and `/auth/recovery`. A preview pattern scoped to this team, e.g. `https://havencare-frontend-*-havencare.vercel.app/auth/**`, is acceptable on staging only | Exact `<origin>/auth/callback` and `<origin>/auth/recovery`. **No wildcards** |
| Minimum password length | Authentication → Providers → Email | Match `frontend/src/lib/password.ts` (8 today) | Same. Raise both to 12 together (Phase 2) |
| Required characters | Same | Leave off until the UI rules include a lowercase rule, then set lowercase, uppercase, digits and symbols | Same |
| Secure password change | Same | On | On |
| Email OTP expiry | Same | 900 s | 900 s. Keep OTP length at 6 to match the recovery form |
| Leaked-password protection | Authentication → Attack Protection | On, if the plan allows | On (Pro plan at the time of writing) |
| CAPTCHA (Turnstile) | Same | Enable **only after** the frontend sends CAPTCHA tokens (Phase 2), or sign-up and sign-in break | Same |
| Custom SMTP | Authentication → Emails → SMTP Settings | Brevo test sender | Brevo with an authenticated sender on the clinic domain (SPF, DKIM, DMARC) |
| Email templates | Authentication → Emails → Templates | Paste `supabase/templates/*.html` | Same |
| Email send frequency | Authentication → Rate Limits | 60 s or more | 60 s or more |
| MFA (TOTP) | Authentication → Multi-Factor | Enabled | Enabled. Enforcement for staff ships in Phase 2 |
| Session time-box and inactivity timeout | Authentication → Sessions | Optional | Set (Pro plan feature) |
| Google provider | Authentication → Providers → Google | Development OAuth client | Clinic-owned OAuth client. Keep `VITE_GOOGLE_LOGIN_ENABLED=false` until it exists |
| GraphQL and Realtime | Database → Extensions, Realtime | Disable if unused | Disable if unused |
| SSL enforcement and network restrictions | Project Settings → Database | Optional | SSL enforced. Direct Postgres limited to operator IPs. The API connects over HTTPS, so this does not affect the app |

## Vercel environments

| Variable | Project | Preview (staging) | Production |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | backend | Staging project | Production project |
| `CORS_ORIGIN` | backend | Staging frontend origin | Production frontend origin |
| `NODE_ENV` | backend | `production` | `production` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend | Staging project | Production project |
| `VITE_API_URL` | frontend | Staging backend | `/api` (same-origin rewrite) |

**Code change required before splitting Preview from Production:**

- `frontend/src/lib/apiBase.ts` sends every `*.vercel.app` host to `/api`.
- `frontend/vercel.json` rewrites `/api` to the production backend.
- After the split, a Preview frontend would therefore call the production backend with a staging token and get 401.
- Make Preview honor its own API URL in the same change that points Preview at staging.
- On 2 Nov 2026, `VITE_API_URL` was set for both Preview and Production, so check its values before relying on it.

**Content Security Policy:** `frontend/vercel.json` currently allows any `https://*.supabase.co` project, because the production project does not exist yet. Once it does, replace the wildcard with the exact project origin(s) for staging and production.

**Before commercial use:** upgrade the Vercel team to **Pro**. The Hobby plan does not permit commercial use.

## Keys and access

- **Rotate the staging secret key.** It was shared on lab and shared computers. Rotate it in Project Settings → API Keys, then update the Vercel Preview variables and each developer's `backend/.env`.
- **The production secret key** exists in only two places:
  - the Vercel Production environment
  - a sealed entry in the password manager, readable by the two operators below
- **When someone leaves the team or the engagement:** rotate the production key, then remove their access in Supabase, Vercel, and GitHub.

| Name | Supabase role | Vercel role | Production key | Added |
|---|---|---|---|---|
| _to fill_ | | | | |

## Before the first real patient

- [ ] Privacy notice approved by the clinic and its legal adviser, DPO named in it, and `PRIVACY_NOTICE_VERSION` changed from the draft.
- [ ] Breach procedure in `RUNBOOK.md` confirmed by the DPO, contacts filled in.
- [ ] Production project created as above, migrations verified, advisors reviewed.
- [ ] Supabase organization on Pro; daily backups visible in Database → Backups.
- [ ] Vercel team on Pro; Preview points at staging; production keys appear nowhere else.
- [ ] Hosted Auth settings applied; SMTP delivers to a real inbox; redirect URLs exact.
- [ ] Staging secret key rotated; access list above filled in.
