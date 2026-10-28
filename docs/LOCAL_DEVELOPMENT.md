# Run HavenCare locally against hosted Supabase

For **Docker-based local Supabase, Windows/Linux startup, and automated tests**,
use the [local setup/testing guide](LOCAL_TESTING.md). This page covers running
the application against a shared hosted development database.

Use Node.js 24 and npm. Use the team's current integrated development branch;
check it with `git branch --show-current` rather than following a historical
feature-branch name from an older setup note.
Run commands from the cloned project root containing `frontend/` and `backend/`.
Docker and a local Supabase stack are not required for this setup.

## Start here: a Windows PC with nothing installed

Use Windows 10 or 11, 64-bit, with internet access. On a computer-shop PC, ask
the attendant whether installations are allowed; an installer may require their
administrator approval. Edge or another existing browser is enough.

Install these three applications. Open each download website in your browser,
save the installer, then open it from the Downloads folder.

| Install | Official download | Choose | Purpose |
|---|---|---|---|
| Visual Studio Code | <https://code.visualstudio.com/download> | Windows User Installer, x64 for a typical Intel/AMD PC | Edit project files and run commands in its terminal |
| GitHub Desktop | <https://desktop.github.com/download/> | Windows 64-bit | Download the repository, switch branches, commit, and push |
| Node.js | <https://nodejs.org/en/download> | Version 24.x LTS, Windows x64 Installer (.msi) | Run the frontend/backend; npm is included |

For VS Code, keep the default installation folder and enable Add to PATH when
offered. Install **Visual Studio Code**, not the separate Visual Studio product.
GitHub Desktop and Node.js can use their default installation options. Additional
native build tools are not needed for this project's initial setup.

After installation, close and reopen VS Code. Select **Terminal → New Terminal**
from its top menu, then run:

```powershell
node --version
npm.cmd --version
```

The first command must report `v24.x.x`; the second must print a version number.
If Windows says either command is not recognized, reopen VS Code after installing
Node.js. If it still fails, check that Node.js was installed with its PATH option.

### Get your account and repository ready

1. Create your own account at <https://github.com/signup>, or sign in to your
   existing GitHub account. Ask the maintainer to invite that account to the repo
   and accept the invitation.
2. Open GitHub Desktop and choose **Sign in to GitHub.com**. Complete the browser
   sign-in, return to Desktop, and configure your commit name and email.
3. In Desktop, choose **File → Options → Integrations**, select Visual Studio
   Code as the external editor, and save.
4. Choose **File → Clone repository → URL** and enter
   `https://github.com/Haven-Care/Bernardos-Maternity-and-Lying-in-Clinic.git`.
   Choose a local folder you can find again, such as a `Projects` folder under
   Documents, and click **Clone**.
5. Click **Fetch origin**, open **Current branch**, and select the current
   development branch agreed with the maintainer. Avoid branches starting with
   `archive/`.
6. Choose **Repository → Open in Visual Studio Code**. The folder should contain
   `frontend`, `backend`, and `supabase`. Continue with the dependency installation
   below.

No separate Git command-line installation, Codex, Docker, PostgreSQL, or Supabase
desktop application is required for this GitHub Desktop + hosted Supabase setup.
VS Code extensions are optional for the first run.

## 1. Install dependencies

Open the project in VS Code. In its terminal, run:

```powershell
cd backend
npm ci
cd ../frontend
npm ci
```

Install dependencies separately in both folders. Installing at the repository
root does not install the frontend or backend dependencies. If PowerShell blocks
`npm.ps1`, use `npm.cmd` in place of `npm` in these commands.

## 2. Create private environment files

For a fresh clone, copy `backend/.env.example` to `backend/.env`, and
`frontend/.env.example` to `frontend/.env`. VS Code's Explorer can copy and rename
the files. Do not overwrite an existing configured `.env`.

The examples include the hosted project URL and public publishable key. Obtain
your backend secret key privately from the maintainer. Both packages must use the same Supabase project. Do not use
the production project's credentials for team testing.

Set `backend/.env` to:

```dotenv
PORT=6101
NODE_ENV=development
CORS_ORIGIN=http://localhost:6100
SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-DEV-SERVICE-ROLE-KEY
```

Set `frontend/.env` to:

```dotenv
VITE_API_URL=http://localhost:6101/api
VITE_SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-DEV-ANON-KEY
```

Replace the placeholders with real values. Do not copy `127.0.0.1:54321` from the
templates when using hosted Supabase: that address expects a local database stack.

The anon key goes in the frontend. The service-role key belongs only in the
backend: never put it in a `VITE_` variable, screenshot, commit, or public message.
Both `.env` files are ignored by Git and must be recreated on a fresh computer.
Restart both servers after changing them.

The maintainer must first apply the repository's migrations to the development
project, provision synthetic data and test accounts, and configure hosted Auth.
Credentials alone do not create the schema. Do not run database resets or seed
SQL against a shared project as part of ordinary startup; the seed truncates data.

## 3. Start both servers

Open two terminals in VS Code, starting each at the project root.

Backend terminal:

```powershell
cd backend
npm run dev
```

Frontend terminal:

```powershell
cd frontend
npm run dev -- --port 6100 --strictPort
```

Open <http://localhost:6100>. Keep both terminals running; Ctrl+C stops a server.
Port 6100 is reserved for HavenCare so it does not use Vite's usual port 5173.
The frontend port must match the backend's `CORS_ORIGIN`. `--strictPort` reports
an occupied port rather than silently switching to a different origin.

## 4. Check the result

- <http://localhost:6101/api/health> must return `{"status":"ok"}`.
- <http://localhost:6101/api/health/db> must also return `{"status":"ok"}`.
- The frontend must render, sign in with a development test account, and load
  database-backed content. A running Vite process or successful build alone
  does not verify this.

The browser connects to Supabase Auth for login. Application requests go to the
local Express backend, which connects to hosted Supabase for data and storage.
Writes affect the configured shared development database, not a private local copy.

## Historical setup notes — 2026-10-18

- At that date, `feat/mobile-patient-ui` included the newer dashboard date-range API.
  The older `archive/feat/backend-api` snapshot expects an incompatible database
  interface and is retained only as an archive.
- Frontend and backend use ports 6100 and 6101. `npm run dev` reads the port from
  each package's `.env`; the frontend stops if its port is occupied.
- If Vite serves a blank page with outdated optimized dependency errors after
  switching branches, stop it and run `npm run dev -- --force` once.
- Restart the backend after changing `.env`; an existing client retains the old
  credentials until its process is restarted.
- The online database accepted the newer `dashboard_stats` and
  `appointment_status_counts` functions with a `p_range` argument. Do not replace
  them with the archive's older SQL or reset the shared database.

On a shared computer, commit and push before leaving, sign out of the app and
GitHub sessions, and remove local credentials. A locally running backend requires
the privileged development key on that computer; use a hosted development API
instead if the computer cannot be trusted with it.

## Shared login and password recovery

The shared sign-in page is `/login`. `/`, `/patient/login`, and `/admin/login`
reach the same form. The backend's authenticated `/api/account/session` endpoint
resolves active staff/administrator profiles and confirmed patient accounts;
client-editable metadata cannot select a staff role. Existing patient and staff
API guards remain responsible for authorizing each request.

Password recovery accepts the six-digit code from `supabase/templates/recovery.html`
or the standard Supabase recovery email link. For each hosted environment, add
its frontend `/auth/recovery` URL to Supabase Auth's redirect allowlist and keep
Site URL pointed at the frontend. For example, the current frontend callback is
`https://havencare-frontend-ruddy.vercel.app/auth/recovery`. Use the eventual custom
domain when one is configured. These hosted Auth settings are separate from the
local `supabase/config.toml` file. Keep the hosted email OTP length set to six
digits to match the recovery form. A verified recovery session is required before
the new-password form can be used. The browser signs out locally after success.

Client **Profile → Password Management** sends a recovery code to the registered
account email and opens the shared verification screen. It does not collect the
current or new password before email verification. Unsaved profile/notification
changes require confirmation before leaving; failed email requests keep the client
on Profile. The new-password screen requires the verified recovery session.
For this code flow, the hosted **Reset Password** email template must include
`{{ .Token }}` (use `supabase/templates/recovery.html`); a link-only template will
not display the code. Pushing to GitHub does not update hosted Auth templates.

SMTP credentials and an inbox delivery test are still required to verify real
email delivery. Do not use a real patient's address for development tests.
See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Production deployment branch — 21 October 2026

Both `havencare-frontend` and `havencare-backend` now track `main` for production
in Vercel's Production environment. Team branches remain preview branches.
Changing branch tracking does not publish uncommitted local work or automatically
apply SQL migrations. Deploy the frontend and backend from the same integrated
commit: shared login requires the backend session endpoint, and historical date
filters require the updated paginated endpoints.

Custom dashboard dates use exact API counts against existing tables and do not
require a new database migration. Inventory alerts remain current regardless of
the selected date range. Appointment dates and timestamp cutoffs use Manila time.

## Google sign-in

The frontend uses Google's official Identity Services button on the website.
Google returns an ID token to the page; `supabase.auth.signInWithIdToken()`
exchanges it for a Supabase session. The frontend then calls
`/api/account/session` for the server-verified role and preserves the requested
destination. Google metadata cannot grant staff access. Existing staff profiles
remain the authority, and new Google users become patients. Complete missing
patient contact details before booking.

In Google Cloud → Google Auth Platform → Clients, open the existing **Web**
OAuth client. Under **Authorized JavaScript origins**, add each exact origin
that serves the app, without paths or trailing slashes:

- Production: `https://bernardo-clinic.vercel.app`
- Local testing: `http://localhost:6100` (and `http://127.0.0.1:6100` if used)
- Any other deployed hostname where Google sign-in should work, individually.

The clinic domain must serve the app directly; redirecting elsewhere changes
the origin Google receives. Keep the existing Supabase callback URI and
`/auth/callback` route for older deployed clients during rollout. The new
JavaScript popup flow does not use that redirect. Do not change the callback URI
to the frontend root.

Keep the same client ID and client secret configured in Supabase Auth →
Providers → Google, with nonce checking enabled. Set these **frontend** variables
locally and in Vercel → frontend project → Settings → Environment Variables:

```dotenv
VITE_GOOGLE_LOGIN_ENABLED=true
VITE_GOOGLE_CLIENT_ID=619815113208-dr02v4db3ifrp2ql0mgct36si6u4hthq.apps.googleusercontent.com
```

The client ID is public and must match Supabase's Google provider. The **client
secret belongs only in Supabase**, never in a `VITE_` variable or Git. Restart
Vite after local environment changes; redeploy Vercel after production changes
because Vite embeds these values at build time. When testing with local Supabase,
configure the matching Google client in that stack too; do not mix hosted and
local Auth settings.

Each mounted sign-in attempt generates a cryptographically random nonce. Google
receives its SHA-256 hexadecimal hash; Supabase receives the original. Failed
exchanges rotate the nonce before retry. Blocked SDK downloads show a retry and
leave email/password sign-in available. Closing the Google popup does not leave
the form stuck submitting. The app does not automatically fall back to the
Supabase redirect flow.

Before release, test with a clinic-authorized Google account on the intended
domain. Verify the account chooser's actual domain/name, new-patient registration,
existing-account linking, staff routing, rejected/deactivated accounts, and
cancelled consent. Google controls the displayed identity; this integration does
not guarantee exact consent-screen wording or replace Google's brand verification.
Local mocked tests do not verify Google consent or hosted provider configuration.
See [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
and [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## Medicine photos

Apply `20261022000016_medicine_photos.sql` before deploying the photo endpoints.
It adds a private `medicine-photos` bucket and the `medicine_photos` table with RLS
and no browser policies. The API requires staff authentication for upload tickets,
photo attachment, and short-lived view links. JPG, PNG, and WebP files are limited
to 5 MB, both in the picker and in storage. SQL migration application and hosted
storage checks are separate from frontend/backend build success.

A new medicine is saved before its photo uploads. If storage fails, the modal
states that the details were saved and retains the medicine ID and selected photo
for retry; retrying does not create another medicine. Undoing the pending photo
selection keeps the already-saved details. Cancelling the native file picker must
leave the modal and current selection intact. Replacing a photo commits the new
object path before attempting to remove the previous object. Failed/unattached
uploads can remain in storage and may need periodic orphan cleanup.

Before release, verify staff upload/read access and patient/anonymous denial on
the intended Supabase project. Database types include the new table definition;
regenerate them against a disposable migrated local database when available.

## Visit management, services, and batch numbers

Apply migrations 17–20 in order. Migration 17 commits the `arrived` and `no_show`
enum values before migration 18 uses them. Apply migration 23 for automatic
booking acceptance: successful submissions are **Booked** (`pending` in the
database) and reserve capacity immediately. Existing `confirmed` rows become
Booked; the Confirm action and Confirmed status have been removed.

Visit management defaults to today's active appointments and supports custom
dates, reference search, arrival, completion, cancellation, and no-show recording.
Booked and rescheduled appointments can move directly to Arrived from the
appointment date; completion follows arrival. No-show is allowed after the
scheduled time. Rescheduling is available before
arrival. Arrived patients must be managed by staff.

Staff transitions run in a row-locked database function, append an audit event,
and close open reschedule requests when attendance starts or the visit ends.
Completed, cancelled, and no-show visits are terminal. For historical accounting,
no-show bookings continue to count toward their original slot, like completed
visits; cancellation releases a slot. Patient history shows current statuses.
These are in-app updates; SMTP email delivery is a separate integration.

Migration 19 originally added placeholder poster rates. Migration 22 replaces
those with the clinic-supplied service and price list, with separate entries for
PhilHealth delivery rates and first/subsequent prenatal visits. It preserves
service IDs, appointment snapshots, and staff deactivations; superseded prototype
offerings remain inactive. Hearing Test is ₱650 and inactive. Norifam has a null
price and displays **Contact clinic for price**, rather than an invented rate.
Temporary-price badges and the administration checkbox have been removed. Apply
migration 22 before running the updated API; the fresh seed uses the same rates.

Stock In generates an editable batch number. Custom values accept up to 64
letters, numbers, spaces, hyphens, #, underscore, slash, and period, with at least
one letter/number. Validation runs in the form, API, and stock-in function. Blank
API/SQL values generate a number. Existing batch top-up and expiry rules remain;
maximum-stock, percentage, low-stock policy changes, and clinical-condition lists
are awaiting clinic decisions.

`supabase/tests/visit_workflow.sql` exercises reservation, same-day transitions,
terminal-state protection, cancellation/request cleanup, audit events, batch
validation, clinic rates, and RLS posture on a disposable migrated/seeded DB.
It rolls its synthetic records back. The test also passed with PGlite using minimal
Auth/Storage schema stubs; that verifies PostgreSQL rules, not hosted GoTrue,
PostgREST, Storage uploads, or concurrent HTTP requests. The full Supabase
integration suites still require a running local stack.

## Free public URL and SMTP follow-up — 22 October 2026

**URL update — 27 October 2026:** `https://bernardo-clinic.vercel.app` now serves
the frontend directly. Supabase's hosted Site URL was changed to this origin;
its `/auth/callback` and `/auth/recovery` return routes were added to the redirect
allowlist, with wildcard matching for legacy callback query strings. A callback
error redirects to this origin, and `/login` and
`/auth/callback` both return HTTP 200. A complete Google account sign-in still
requires user acceptance testing. The paragraphs below record the earlier setup.

`bernardo-clinic.vercel.app` is attached to the frontend project. It temporarily
redirects (307) to `havencare-frontend-ruddy.vercel.app`, because the deployed
frontend's API transport recognizes only its previous hostname. This branch fixes
transport for every `.vercel.app` frontend using the existing same-origin proxy.
After deploying this branch's reviewed code and migrations, change the new domain
back to Production in Vercel, verify `/book` loads services through `/api`, and
add its recovery/OAuth callback URLs to Supabase before making it canonical. The
old domain remains available during the transition. The domain configuration
change did not publish this branch's feature code.

Brevo is recommended for the current free-domain setup (300 sends/day on its
free plan). A free mailbox sender may be rewritten under `brevosend.com`; an owned
authenticated email domain is needed for fully branded sending. The clinic must
choose a sender, authorize a test inbox, and privately configure SMTP credentials
in Supabase. No email-provider account, paid domain, or Terms of Service was
created. Google OAuth remains disabled until its clinic-owned project is ready.
