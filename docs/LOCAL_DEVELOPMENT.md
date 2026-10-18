# Run HavenCare locally against hosted Supabase

These instructions apply to `feat/mobile-patient-ui`. Use Node.js 24 and npm.
Run commands from the cloned project root containing `frontend/` and `backend/`.
Docker and a local Supabase stack are not required for this setup.

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

Request the development project's URL, anon key, and service-role key privately
from the maintainer. Both packages must use the same Supabase project. Do not use
the production project's credentials for team testing.

Set `backend/.env` to:

```dotenv
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5174
SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-DEV-SERVICE-ROLE-KEY
```

Set `frontend/.env` to:

```dotenv
VITE_API_URL=http://localhost:4000/api
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
npm run dev -- --port 5174 --strictPort
```

Open <http://localhost:5174>. Keep both terminals running; Ctrl+C stops a server.
Port 5174 is explicit because another project uses 5173 on the maintainer's PC.
The frontend port must match the backend's `CORS_ORIGIN`. `--strictPort` reports
an occupied port rather than silently switching to a different origin.

## 4. Check the result

- <http://localhost:4000/api/health> must return `{"status":"ok"}`.
- <http://localhost:4000/api/health/db> must also return `{"status":"ok"}`.
- The frontend must render, sign in with a development test account, and load
  database-backed content. A running Vite process or successful build alone
  does not verify this.

The browser connects to Supabase Auth for login. Application requests go to the
local Express backend, which connects to hosted Supabase for data and storage.
Writes affect the configured shared development database, not a private local copy.

## Confirmed troubleshooting results — 2026-10-18

- `tsx: command not found`: backend dependencies were missing; `npm ci` fixed it.
- The mobile worktree had neither `.env` file. Private templates were created;
  hosted credentials are still required.
- Existing environment files in other worktrees referenced local Supabase and
  were not copied into this hosted setup.
- Port 5173 belonged to a different project. HavenCare runs on 5174 with matching
  backend CORS, leaving that project running.
- In the Codex sandbox, esbuild installation and localhost binding were blocked
  by `EPERM`. Retrying outside the sandbox succeeded; this is separate from a
  teammate's ordinary Windows setup.
- Both servers started; frontend HTTP response and API health returned 200.
  Database readiness returned 503 for missing `SUPABASE_URL`. Browser rendering,
  authentication, and database-backed workflows remain unverified until credentials
  are supplied.
- Both builds and lint checks passed. Frontend: 24 tests passed. Backend: 8 passed,
  115 database-dependent tests skipped without credentials.
- Backend `npm audit` reported 2 high and 1 critical dependency vulnerabilities.
  Dependency upgrades were not applied during setup troubleshooting.

On a shared computer, commit and push before leaving, sign out of the app and
GitHub sessions, and remove local credentials. A locally running backend requires
the privileged development key on that computer; use a hosted development API
instead if the computer cannot be trusted with it.
