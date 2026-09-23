import type { ZodType } from 'zod'
import { HttpError } from '../middleware/errorHandler.js'

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
