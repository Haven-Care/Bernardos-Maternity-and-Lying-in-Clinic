# 🏥 HavenCare

Centralized Management System for **Bernardo's Maternity and Lying-in Clinic**.

One system, two products:

| Product | Users | What it does |
|---|---|---|
| **Command center** (desktop) | Clinic staff | Daily schedules, inventory movements, patient records, service configuration |
| **Booking app** (mobile) | Patients | Book from home against the slots staff opened; no phone call, no walk-in |

Five modules: **Dashboard · Appointments · Inventory · Patient Records · Administration**.

React (TypeScript) frontend, Express (TypeScript) API, Supabase for data.

> **Status:** 🚧 Building the UI layer first, against mock data.
>
> The [Figma prototype](https://www.figma.com/design/HN1MtjiHtwzJKvBLXCjWqC/HavenCare-Prototype)
> is complete and high-fidelity; the backend is not — **controllers are stubs and
> no database schema exists yet.** So screens are being built against fixtures
> behind a typed `src/api/` seam, and the backend is implemented afterward
> against the types that produces.
>
> See [Current State](#-current-state) before picking up work.

---

## 🛠️ Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7 |
| Backend | Node.js, Express 5, TypeScript (`tsx` dev / `tsc` build) |
| Database | Supabase (`@supabase/supabase-js`) |
| Tooling | ESLint 10, typescript-eslint, GitHub Actions |

Frontend uses the native `fetch` API (`src/lib/api.ts`) — no Axios.

---

## 📁 Project Structure

```text
Bernardo's Maternity and Lying-in Clinic/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts              # env parsing, required-var guards
│   │   │   └── supabase.ts         # lazy singleton Supabase client
│   │   ├── controllers/            # ⚠️ all stubs — see Current State
│   │   ├── middleware/
│   │   │   └── errorHandler.ts     # HttpError, notFoundHandler, errorHandler
│   │   ├── routes/
│   │   │   ├── index.ts            # /health, /health/db, mounts sub-routers
│   │   │   ├── booking.routes.ts
│   │   │   └── inventory.routes.ts
│   │   ├── types/
│   │   ├── app.ts                  # createApp() — cors, json, routes, handlers
│   │   └── server.ts               # listen()
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/layout/
│   │   ├── lib/api.ts              # apiFetch<T>() wrapper
│   │   ├── pages/                  # Home, Booking, Inventory, NotFound
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── main.tsx
│   ├── .env.example
│   └── package.json
│
├── .github/
│   ├── workflows/                  # backend-ci.yml, frontend-ci.yml
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── CONTRIBUTING.md
└── README.md
```

---

## ✅ Prerequisites

- **Node.js 20.x** — CI pins Node 20; match it locally to avoid build drift
- **npm** (bundled with Node)
- **Git**
- A **Supabase project** — you need `SUPABASE_URL` and the `service_role` key

---

## 🚀 Getting Started

### 1. Clone

```bash
git clone git@github.com:Haven-Care/Haven-Care-Website.git
```

```bash
cd "Haven-Care-Website/Bernardo's Maternity and Lying-in Clinic"
```

### 2. Backend

```bash
cd backend && npm install && cp .env.example .env
```

Fill in `backend/.env`:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Project Settings > API in your Supabase dashboard
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Never commit `.env`, and never put the `service_role` key in the frontend.** It bypasses row-level security. Only `.env.example` is tracked.

Start it:

```bash
npm run dev
```

API is at `http://localhost:4000`. Confirm with:

```bash
curl http://localhost:4000/api/health
```

### 3. Frontend

New terminal:

```bash
cd frontend && npm install && cp .env.example .env
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

```bash
npm run dev
```

App is at `http://localhost:5173`.

Both processes must be running — the frontend calls the backend directly (no Vite proxy configured), so `CORS_ORIGIN` on the backend must match the frontend's origin.

---

## 📦 Scripts

| Where | Command | What it does |
|---|---|---|
| `backend` | `npm run dev` | `tsx watch src/server.ts` — hot reload |
| `backend` | `npm run build` | `tsc -b` → `dist/` |
| `backend` | `npm start` | Run compiled `dist/server.js` |
| `backend` | `npm run lint` | ESLint |
| `frontend` | `npm run dev` | Vite dev server |
| `frontend` | `npm run build` | `tsc -b && vite build` |
| `frontend` | `npm run preview` | Serve the production build locally |
| `frontend` | `npm run lint` | ESLint |

There is **no `test` script in either package** — see [Current State](#-current-state).

---

## 🔐 Environment Variables

| Variable | Side | Required | Notes |
|---|---|---|---|
| `PORT` | backend | no | Defaults to `4000` |
| `NODE_ENV` | backend | no | Defaults to `development` |
| `CORS_ORIGIN` | backend | no | Defaults to `http://localhost:5173` |
| `SUPABASE_URL` | backend | **yes** | Throws on first use if missing |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | **yes** | Secret. Server-side only |
| `VITE_API_URL` | frontend | no | Defaults to `http://localhost:4000/api` |

The two Supabase vars are lazy getters in [`config/env.ts`](backend/src/config/env.ts) — the server **starts fine without them** and only throws when a Supabase call is first made. Hit `/api/health/db` to verify credentials.

---

## 🔌 API Reference

Base path: `/api`

| Method | Endpoint | Current behavior |
|---|---|---|
| `GET` | `/health` | ✅ `{ status: "ok" }` |
| `GET` | `/health/db` | ⚠️ Only checks that Supabase env vars are set — see note below |
| `GET` | `/bookings` | ⚠️ Returns `[]` (hardcoded) |
| `GET` | `/bookings/:id` | ⚠️ Always `404` |
| `POST` | `/bookings` | ⚠️ `501 Not Implemented` |
| `PATCH` | `/bookings/:id` | ⚠️ `501 Not Implemented` |
| `DELETE` | `/bookings/:id` | ⚠️ `501 Not Implemented` |
| `GET` | `/inventory` | ⚠️ Returns `[]` (hardcoded) |
| `GET` | `/inventory/:id` | ⚠️ Always `404` |
| `POST` | `/inventory` | ⚠️ `501 Not Implemented` |
| `PATCH` | `/inventory/:id` | ⚠️ `501 Not Implemented` |
| `DELETE` | `/inventory/:id` | ⚠️ `501 Not Implemented` |

Errors are uniform: `{ "error": "message" }`.

> **`/health/db` does not currently reach the database.** It calls `supabase.auth.getSession()`, which reads local session state — and with `persistSession: false` there is none, so no network request is made. It returns `ok` even with a wrong URL, a revoked key, or an empty database. All it really proves is that the env-var getters in `config/env.ts` didn't throw. A real check needs a query against an actual table, e.g. `.from('bookings').select('id').limit(1)`.

### Data shapes

```ts
interface Booking {
  id: string
  patientName: string
  service: string
  startsAt: string                                  // ISO 8601
  status: 'pending' | 'confirmed' | 'cancelled'
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  reorderThreshold: number
}
```

These are **TypeScript types only** — there are no matching Supabase tables in the repo.

---

## 📊 Current State

### What works

- Express app wiring — CORS, JSON body parsing, router mounting, 404 + error middleware
- Env config with required-variable guards
- Lazy singleton Supabase client
- Liveness health check (`/api/health`) — note `/api/health/db` is not a real DB check yet
- Frontend routing across Home / Booking / Inventory / NotFound with a shared layout
- Typed `apiFetch<T>()` helper
- Lint + build CI on PRs into `main`, `backend-main`, `frontend-main`

### Not implemented yet

| Gap | Impact |
|---|---|
| **Database schema** | No SQL migrations, no `supabase/` directory. Tables must be hand-created in the dashboard, and nothing is reproducible or reviewable. |
| **Controller logic** | No controller imports `getSupabaseClient()`. Every write returns `501`; reads return empty arrays. The API is a shell. |
| **Authentication** | No auth middleware, no protected routes, no RLS policies in repo — despite this handling patient data. |
| **Tests** | Neither `package.json` has a `test` script, so CI's `npm test --if-present` silently passes. **Green CI does not mean tested.** |
| **Docker** | No `Dockerfile` (either side), no `docker-compose.yml`, no `.dockerignore`. Setup is manual-only. |
| **Deployment** | CI runs on `pull_request` only — no build-on-merge, no deploy workflow, no hosting target chosen. |
| **Request validation** | No schema validation (Zod or similar) on any request body. |
| **Shared types** | `booking.ts` and `inventory.ts` are byte-identical in `backend/src/types/` and `frontend/src/types/`. They will drift. Superseded once `supabase gen types` lands. |

> **Note on CODEOWNERS:** [`.github/CODEOWNERS`](.github/CODEOWNERS) now points at
> `@Haven-Care/*` teams. Those teams must actually exist and have write access —
> GitHub silently ignores unresolvable owners, which would mean the PM/QA
> approval rule in `CONTRIBUTING.md` isn't enforced at all. Verify in branch
> protection settings.

---

## 🧑‍💻 Development Workflow

**Terminal 1**

```bash
cd backend && npm run dev
```

**Terminal 2**

```bash
cd frontend && npm run dev
```

Branch off your team's integration branch (`frontend-main` / `backend-main`), never off `main`. Naming, commit format, and PR requirements are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

Before opening a PR:

```bash
npm run lint && npm run build
```

---

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
