/**
 * The real HTTP client, unused until the first domain is swapped.
 *
 * `apiFetch` already has the right shape for the seam, so it stays where it is
 * and this file just re-exports it. When auth lands, the `Authorization: Bearer`
 * header is added in `lib/api.ts` — one place, and every domain picks it up.
 */
export { apiFetch } from '../lib/api'
