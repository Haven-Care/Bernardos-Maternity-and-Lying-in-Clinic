import { z, type ZodType } from 'zod'
import { HttpError } from '../middleware/errorHandler.js'

/**
 * A `YYYY-MM-DD` that is also a real calendar date.
 *
 * The shape check alone lets 2026-02-30 through, and Postgres then refuses it
 * on the cast to `date` — a 500 for what is plainly the caller's mistake. The
 * round trip catches it here as a 400: a date that does not exist comes back
 * from `toISOString` as a different day.
 */
export function isoDate(message = 'Enter a date like 2026-09-21.') {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`)
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
    }, 'That date does not exist.')
}

/**
 * Parses a request body against a schema, or throws a 400 the UI can show.
 *
 * Nothing validated anything before this. Every handler that accepts a body
 * runs it through here, so a malformed request fails at the edge with a
 * readable message rather than as a constraint violation three layers down.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (result.success) return result.data

  // One message, first error, addressed to whoever is looking at the form.
  // The full issue list is available but is developer-shaped, and these strings
  // are rendered directly in toasts and field errors.
  const issue = result.error.issues[0]
  const path = issue.path.join('.')

  throw new HttpError(400, path ? `${path}: ${issue.message}` : issue.message)
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parseBody(schema, query)
}
