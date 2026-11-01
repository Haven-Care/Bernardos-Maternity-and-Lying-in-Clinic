import { getAccessToken, supabase } from './supabase'
import { apiBaseUrl } from './apiBase'

/** A request with no answer by then is reported as one, not left spinning. */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * Fired when the API refuses a token this tab sent: it expired, was revoked,
 * or the account was signed out elsewhere. The signed-in areas listen for it
 * and send the user to sign in again.
 */
export const SESSION_EXPIRED_EVENT = 'havencare:session-expired'

// Vercel previews are protected separately from the backend preview. Route
// their API calls through this frontend's same-origin proxy to the public API,
// so a patient session is not blocked by the backend preview's SSO or CORS.
const API_URL = apiBaseUrl(window.location.hostname, import.meta.env.VITE_API_URL)

/**
 * A response the API actually sent, with its status.
 *
 * Kept distinct from a network failure (a plain `TypeError` from `fetch`) so a
 * caller can tell "the server says no" from "the server did not answer" —
 * the route guards redirect on the first and offer a retry on the second.
 */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Whether a failed account lookup means "not signed in here": no or expired
 * token (401), the wrong realm or a deactivated account (403), no account row
 * (404). Anything else — the network, a 5xx — says nothing about the session.
 */
export function isSessionError(error: unknown): boolean {
  return error instanceof ApiError && [401, 403, 404].includes(error.status)
}

/**
 * The one place a request leaves the browser.
 *
 * Attaching the bearer token here rather than at each call site means every
 * domain picks up authentication for free, and there is a single place to change
 * when it evolves.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken()

  // An AbortController and a timer rather than AbortSignal.timeout/any, which
  // the older iPhones patients book from do not all have. A caller's own
  // signal still cancels the request.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const callerSignal = init?.signal
  const forwardAbort = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) forwardAbort()
  else callerSignal?.addEventListener('abort', forwardAbort, { once: true })

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (!timedOut) throw error
    const timeout = new Error('The clinic server took too long to respond. Please try again.')
    timeout.name = 'TimeoutError'
    throw timeout
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', forwardAbort)
  }

  if (!res.ok) {
    if (res.status === 401 && token) await expireSession()
    throw new ApiError(res.status, await errorMessage(res))
  }

  // 204 and other empty responses have no body to parse, and calling .json()
  // on one throws a SyntaxError that looks like a server fault.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
}

/**
 * The API refused the token this tab holds. Forget it locally, so nothing
 * keeps sending a dead credential, and tell whichever signed-in area is open.
 * Local only: there is no live session left on the server to end.
 */
async function expireSession() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

/**
 * Express renders every failure as `{ error }`, and those strings are written
 * to be shown to whoever is looking at the screen — "That time was just
 * filled", not "409". Surfacing the status code instead would throw away the
 * only useful part.
 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // Not JSON — a proxy error page, or the API is not running.
  }

  if (res.status === 401) return 'Your session has expired. Please sign in again.'
  if (res.status >= 500) return 'Something went wrong. Please try again.'

  return `Request failed (${res.status})`
}
