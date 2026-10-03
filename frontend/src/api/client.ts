/**
 * The HTTP client every domain in this directory calls.
 *
 * `apiFetch` lives in `lib/api.ts` and this file just re-exports it, so the
 * import in each domain file reads `./client` and the transport can move
 * without touching eight files. The `Authorization: Bearer` header is attached
 * there — one place, and every domain picks it up.
 */
export { apiFetch } from '../lib/api'
