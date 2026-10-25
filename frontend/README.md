# HavenCare frontend

React 19, TypeScript, Vite 8, Tailwind CSS v4, and React Router 7.
Use **Node.js 24.x**, matching the repository's `.nvmrc` and CI.

## Windows and Linux setup

Follow the [complete local setup/testing guide](../docs/LOCAL_TESTING.md) for
Docker, local Supabase, actual keys, staff accounts, both development servers,
and tests. It includes Windows PowerShell and Linux Bash commands.

For shared hosted development data, use [the hosted guide](../docs/LOCAL_DEVELOPMENT.md).

## Start the frontend

Install dependencies from the repository root:

```sh
npm --prefix frontend ci
```

Load the operating-system-specific [local environment](../docs/LOCAL_TESTING.md#4-load-local-credentials),
then start Vite from the repository root:

```sh
npm --prefix frontend run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.
Open <http://localhost:6100>. Vite uses a strict port and reports port conflicts.

Required frontend variables are `VITE_API_URL`, `VITE_SUPABASE_URL`, and
`VITE_SUPABASE_ANON_KEY`. The guide loads them automatically. Frontend and backend
must use the same Supabase project. Express/tsx runs the backend separately on
<http://localhost:6101/api>. Keep privileged Supabase keys out of frontend variables.

## Checks

Run from the repository root:

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Tests cover helpers and API seams. For signed-in browser interactions, follow
[the local walkthrough](../docs/LOCAL_TESTING.md#6-check-the-running-app).

## Related files

- [API seam and authentication](src/api/README.md)
- [API contract types](src/types)
- [Vite configuration](vite.config.ts)
- [UI/Figma audit](../docs/figma-ui-audit.md)
- [Contribution workflow](../CONTRIBUTING.md)
