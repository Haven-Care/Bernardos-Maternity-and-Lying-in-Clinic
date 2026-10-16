# `src/api/` — the backend seam

Every backend call in the app goes through this directory. One file per domain,
one exported function per operation. Components call these functions and know
nothing about transport, auth headers, or error shapes.

**The swap is finished.** This layer began as typed fixture functions, each
carrying a `// BACKEND:` comment holding the real call it would one day make;
`src/mocks/` and the last of those markers were deleted when `dashboard` — the
last domain, because it aggregates all the others — moved onto Postgres.

Everything below is now a thin wrapper over `apiFetch`.

## Rules

- **Functions are `async` and fully typed** against `src/types/`, which is the
  contract. The backend mirrors that directory into `backend/src/contract/` and
  CI fails if the copy drifts, so a shape that compiles here is the shape the
  server returns.
- **No derived values.** `qtyOnHand`, Low Stock, Days Left and the dashboard
  aggregates are computed in SQL and arrive ready to render. They used to be
  computed here, which is why the swap replaced whole functions rather than
  rewriting components.
- **No error handling.** `apiFetch` turns a non-2xx into a thrown `Error`
  carrying the server's message, which is written for whoever is looking at the
  screen. `useAsync` and the `AsyncBoundary` components render it.

## Auth

`src/lib/api.ts` attaches `Authorization: Bearer` from the current Supabase
session. One place, and every domain picks it up — nothing in this directory
mentions a token.

Three endpoints stay unauthenticated so a patient can browse before signing up:
`GET /services?active=true`, `GET /slots/availability`, `GET /clinic`. Posting a
booking is not one of them.
