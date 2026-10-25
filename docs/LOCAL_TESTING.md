# Run and test HavenCare locally: Windows and Linux

This guide runs Supabase in Docker and starts the frontend/backend on your
computer. Tests use a **disposable local database**. For shared hosted development
data, use [the hosted guide](LOCAL_DEVELOPMENT.md).

```text
Browser → Vite frontend :6100 → Express backend :6101 → local Supabase :54321
Browser ────────────────────────────────────────────→ local Supabase Auth
Docker: PostgreSQL, Auth, PostgREST, Storage, Studio, and test email inbox
```

The CLI manages Docker using `supabase/config.toml`. Frontend/backend npm
processes run on the host. This repository is initialized already; local startup
does not require Supabase login or linking to a hosted project.

## 1. Install prerequisites

Use **Node.js 24.x**, npm, Git, and Docker. `node --version` must report `v24.x.x`;
`docker info` must include a working **Server** section.

### Windows: PowerShell

1. Install [Git for Windows](https://git-scm.com/download/win) and
   [Node.js 24](https://nodejs.org/en/download).
2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
   with its WSL 2 backend and Linux containers. Follow Docker's current Windows,
   WSL, virtualization, and hardware requirements. If WSL is missing, run
   `wsl --install` in an administrator PowerShell and restart when prompted.
3. Start Docker Desktop, wait for its engine to run, and reopen your terminal.

```powershell
node --version
npm.cmd --version
git --version
docker info
```

Windows examples use `npm.cmd` and `npx.cmd` to avoid execution-policy restrictions
on `npm.ps1`. Use PowerShell with Docker Desktop running. For a checkout inside
WSL, use the Linux commands, install Node inside WSL, and enable Docker's WSL
integration for that distribution. Keep Windows and WSL dependency installations
separate.

### Linux: Bash

Install Git, Node 24, and [Docker Engine](https://docs.docker.com/engine/install/)
using your distribution's instructions. On Arch, the Docker package is `docker`.
If using nvm, run `nvm install 24` and `nvm use 24`.

For systemd-based Docker Engine installations:

```bash
sudo systemctl start docker
sudo groupadd --force docker
sudo usermod -aG docker "$USER"
```

Log out of your desktop session and back in, then reopen your editor/terminal.
Existing processes do not inherit new group membership. Docker-group membership
grants root-level Docker access; see [Docker's Linux post-installation guide](https://docs.docker.com/engine/install/linux-postinstall/).

```bash
node --version
npm --version
git --version
docker info
```

Linux blocks use **Bash**. If your usual shell is Fish, start `bash` in each
terminal before using them. Avoid running npm through `sudo`.

## 2. Get the repository and dependencies

For an existing checkout, open its root containing `frontend/`, `backend/`,
`supabase/`, and `package.json`. Preserve your existing edits and branch.

For a fresh clone, these commands work in both PowerShell and Bash:

```sh
git clone https://github.com/Haven-Care/Bernardos-Maternity-and-Lying-in-Clinic.git
cd Bernardos-Maternity-and-Lying-in-Clinic
git branch --show-current
```

Use the current integrated development branch agreed with the maintainer.
Avoid archived branches mentioned in historical setup notes.

Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
```

Linux Bash:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

The root installs the locked Supabase CLI. It is not an npm workspace: install
dependencies separately in all three folders. Use the repository's npm scripts
and npx CLI so its version matches the configuration.

## 3. Start local Supabase

From the repository root with Docker running:

Windows PowerShell:

```powershell
npm.cmd run db:start
npm.cmd run db:status
```

Linux Bash:

```bash
npm run db:start
npm run db:status
```

First startup downloads images and initializes migrations and the configured
seed. Project ID is `havencare`. `Not linked` is normal here. Optional services
listed as stopped do not by themselves mean the database/Auth/API are unavailable.

| Service | Local address |
|---|---|
| Supabase API | <http://127.0.0.1:54321> |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | <http://127.0.0.1:54323> |
| Test email inbox | <http://127.0.0.1:54324> |

### Optional clean reset

**A reset erases local database data**, reapplies migrations, and runs
`supabase/seed.sql`. Use it for reproducible fixtures, not daily startup for data
you want to keep. It also removes local Auth accounts: seed staff again afterward.
Stop app servers and test runs before resetting.

PowerShell: `npm.cmd run db:reset`

Bash: `npm run db:reset`

Keep `--linked` and hosted database URLs out of this local workflow.
[Supabase migration/reset documentation](https://supabase.com/docs/guides/local-development/database-migrations).

## 4. Load local credentials

Run the appropriate block **from the repository root in every terminal** used
to seed staff, start an app server, or run backend tests. It reads actual local
keys without printing them or changing existing hosted `.env` files.
Do not substitute literal placeholders such as `<local anon key>`.

CLI JSON contains `ANON_KEY` and `SERVICE_ROLE_KEY`, even when its default table
displays newer Publishable/Secret keys. This workflow uses the explicit legacy
keys expected by the test helpers. They belong only to this local stack.
[Supabase CLI status reference](https://supabase.com/docs/reference/cli/supabase-status).

### Windows PowerShell

```powershell
$localSupabase = npx.cmd supabase status --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Start local Supabase before continuing.' }
if ($localSupabase.API_URL -ne 'http://127.0.0.1:54321' -or
    -not $localSupabase.ANON_KEY -or -not $localSupabase.SERVICE_ROLE_KEY) {
    throw 'Expected the configured local Supabase URL and both local keys.'
}
$env:SUPABASE_URL = $localSupabase.API_URL
$env:SUPABASE_ANON_KEY = $localSupabase.ANON_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $localSupabase.SERVICE_ROLE_KEY
$env:SEED_STAFF_PASSWORD = 'HavenCare!2026'
$env:NODE_ENV = 'development'
$env:CORS_ORIGIN = 'http://localhost:6100'
$env:VITE_API_URL = 'http://localhost:6101/api'
$env:VITE_SUPABASE_URL = $localSupabase.API_URL
$env:VITE_SUPABASE_ANON_KEY = $localSupabase.ANON_KEY
$env:VITE_GOOGLE_LOGIN_ENABLED = 'false'
Remove-Variable localSupabase
```

### Linux Bash

```bash
local_supabase_json="$(npx supabase status --output json)"
local_supabase_value() {
  printf '%s' "$local_supabase_json" |
    node -pe 'JSON.parse(require("node:fs").readFileSync(0, "utf8"))[process.argv[1]]' "$1"
}
export SUPABASE_URL="$(local_supabase_value API_URL)"
export SUPABASE_ANON_KEY="$(local_supabase_value ANON_KEY)"
export SUPABASE_SERVICE_ROLE_KEY="$(local_supabase_value SERVICE_ROLE_KEY)"
unset local_supabase_json
unset -f local_supabase_value
if [ "$SUPABASE_URL" != 'http://127.0.0.1:54321' ] ||
   [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] ||
   [ "$SUPABASE_ANON_KEY" = 'undefined' ] || [ "$SUPABASE_SERVICE_ROLE_KEY" = 'undefined' ]; then
  echo 'Expected the configured local Supabase URL and both local keys. Stop here.'
else
  export SEED_STAFF_PASSWORD='HavenCare!2026'
  export NODE_ENV='development'
  export CORS_ORIGIN='http://localhost:6100'
  export VITE_API_URL='http://localhost:6101/api'
  export VITE_SUPABASE_URL="$SUPABASE_URL"
  export VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
  export VITE_GOOGLE_LOGIN_ENABLED='false'
  echo 'Local Supabase credentials loaded; keys are not displayed.'
fi
```

If a block reports an error, stop and fix startup before continuing. Process
environment values override backend dotenv and Vite `.env` values. Restart
servers after changing their environment. New terminals need the block again;
close these terminals when finished to discard their local environment.

Only the anon key is assigned to a `VITE_` variable. Keep the service-role key
out of frontend variables, screenshots, commits, and shared transcripts.
Use `http://localhost:6100` in the browser to match CORS and local Auth redirects.

## 5. Seed staff and start both servers

### Terminal 1: backend

Open a terminal at the repository root and load credentials from section 4.

Windows PowerShell:

```powershell
$env:PORT = '6101'
npm.cmd --prefix backend run seed:staff
if ($LASTEXITCODE -ne 0) { throw 'Staff seeding failed; fix the local credentials.' }
npm.cmd --prefix backend run dev
```

Linux Bash:

```bash
export PORT=6101
npm --prefix backend run seed:staff && npm --prefix backend run dev
```

Staff seeding uses Supabase Auth separately from `seed.sql`. Existing accounts
are skipped. With a fresh reset and this guide's local password:

| Account | Email | Local password |
|---|---|---|
| Administrator | `hannahp@havencare.ph` | `HavenCare!2026` |
| Staff | `staff@havencare.ph` | `HavenCare!2026` |

These are disposable local credentials. Seeding does not reset previously
changed passwords: tests must use the matching password, or start with a clean
disposable database.

### Terminal 2: frontend

Open another terminal at the repository root and load credentials from section 4
again. The backend terminal's exports do not carry into this terminal.

Windows PowerShell:

```powershell
$env:PORT = '6100'
npm.cmd --prefix frontend run dev
```

Linux Bash:

```bash
export PORT=6100
npm --prefix frontend run dev
```

Keep both terminals running. Vite serves the frontend on 6100; `tsx watch`/Express
serves the backend on 6101. Strict port handling reports port conflicts.

## 6. Check the running app

1. Open <http://localhost:6101/api/health> and
   <http://localhost:6101/api/health/db>. Both should return `{"status":"ok"}`;
   the second endpoint actually queries the database.
2. Open <http://localhost:6100/login>, sign in as the local administrator, and
   check dashboard, appointments/visits, inventory, and patient records load.
3. Use a separate browser profile/private window for the patient flow. Register
   a synthetic test address, open its email at <http://127.0.0.1:54324>, and
   confirm the account before booking.
4. Book a service, inspect it in staff view, and test cancellation/rescheduling.
   Check patient history/profile and logout.

Local Auth emails are captured by the test inbox; this does not verify hosted
SMTP delivery. Google login stays disabled here. Staff and patient logins share
a browser origin, so use separate browser profiles to keep both signed in.

## 7. Run automated checks

Open a third terminal at the repository root and load credentials from section 4.
Tests create Express internally through Supertest; frontend/backend dev servers
do not need to run. Supabase does. Keep fixture data idle while tests run.

### Windows PowerShell

```powershell
$env:NODE_ENV = 'test'
npm.cmd --prefix backend run seed:staff
if ($LASTEXITCODE -ne 0) { throw 'Fix staff seeding before integration tests.' }
npm.cmd --prefix backend test
npm.cmd --prefix frontend test
npm.cmd run sync:types:check
npm.cmd --prefix backend run lint
npm.cmd --prefix backend run build
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

Run the separate SQL workflow with its explicit project container:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content -Raw -Encoding UTF8 supabase/tests/visit_workflow.sql |
  docker exec -i supabase_db_havencare psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

### Linux Bash

```bash
export NODE_ENV=test
npm --prefix backend run seed:staff && npm --prefix backend test
npm --prefix frontend test
npm run sync:types:check
npm --prefix backend run lint
npm --prefix backend run build
npm --prefix frontend run lint
npm --prefix frontend run build
```

Run the separate SQL workflow:

```bash
docker exec -i supabase_db_havencare \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/visit_workflow.sql
```

This SQL file is a transaction/assertion script, not pgTAP, so run it through
`psql`. Expected completion includes `DO`, the RLS assertion, and `ROLLBACK`, with
exit code 0. It rolls back synthetic records. HTTP tests modify fixture data;
prepare a clean reset before a reproducible run.

Read each command's exit status and summary. Passing frontend tests do not
cancel out backend failures. Database suites skip when their Auth health probe
fails; skipped tests are incomplete verification. Six suites can also fail
setup if staff seeding failed, leaving their tests unexecuted while Docker runs.

### Recorded verification — 25 October 2026

On Linux with Node 24 and Docker, the backend completed with **171 passed,
none skipped**, and the frontend completed with **77 passed**. Both apps passed
lint and build; shared contracts passed synchronization checks. SQL workflow/RLS
checks passed. Appointment fixtures now use the clinic's current date for
attendance and completion, and the service assertion includes `priceIsTemporary`.
Windows commands were documented but not executed on Windows.

## 8. Stop or restart

Stop app servers with Ctrl+C. Stop Supabase from the repository root with
`npm run db:stop` (`npm.cmd run db:stop` on Windows). Normal stop retains Docker
data volumes. Restart with `db:start`, then reload credentials in each terminal.

For a clean database, stop clients, run `db:reset`, reload credentials, and seed
staff again. Reset invalidates Auth sessions: sign out and back into the browser.

## Troubleshooting

| Symptom | Check or fix |
|---|---|
| `EBADENGINE`, or Node 22 | Select Node 24; reopen terminals/editor so they use it. |
| Docker has only Client, permission denied, or missing socket | Start Desktop/Engine; refresh Linux group membership and restart the editor. |
| `npm.ps1` blocked | Use `npm.cmd` and `npx.cmd` in PowerShell. |
| CLI/config mismatch | Run root `npm ci` and use this repository's scripts/npx. |
| Staff seed requires a valid Bearer token | Reload section 4; literal placeholders/other-project keys cannot authenticate. |
| Suite setup says `Invalid login credentials` | Check staff seed succeeded and the password matches existing local accounts. |
| 115 database tests skipped | Check local Auth/API, URL/anon key, Docker, and suite setup errors. |
| Frontend auth/data failures | Load credentials in both app terminals; use the same Supabase project. |
| Address already in use | Free 6100/6101, or change app ports and CORS/redirect settings together. |
| Vite stale dependencies after a branch switch | Stop Vite and run `npm --prefix frontend run dev -- --force` once. |
| SQL workflow container missing | Check `docker ps` and `db:start`; project ID is `havencare`. |
| Tests fail only on later runs | Reset disposable local fixtures and reseed staff before retrying. |

See [Supabase's local CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started)
for container startup details.
