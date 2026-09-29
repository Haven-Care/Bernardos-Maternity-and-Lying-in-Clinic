import { getAccessToken } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

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

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(await errorMessage(res))
  }

  // 204 and other empty responses have no body to parse, and calling .json()
  // on one throws a SyntaxError that looks like a server fault.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
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
