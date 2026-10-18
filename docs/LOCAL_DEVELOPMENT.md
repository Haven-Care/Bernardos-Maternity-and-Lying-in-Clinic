# Run HavenCare locally against hosted Supabase

These instructions apply to `feat/mobile-patient-ui`. Use Node.js 24 and npm.
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
5. Click **Fetch origin**, open **Current branch**, and select
   `feat/mobile-patient-ui`. Avoid branches starting with `archive/`.
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

## Current setup — 2026-10-18

- Use `feat/mobile-patient-ui`, which includes the newer dashboard date-range API.
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
