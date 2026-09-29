import type { PostgrestError } from '@supabase/supabase-js'
import { HttpError } from '../middleware/errorHandler.js'

/**
 * Turns a Supabase error into the right HTTP status.
 *
 * The plpgsql functions raise custom SQLSTATEs for rules a user can break, so
 * that "that time was just filled" is a 409 the booking form can show, while a
 * genuine fault is a 500 that says nothing. Without this mapping every
 * rejection would surface as an opaque server error and the messages written
 * for patients would never reach them.
 *
 *   HC400  bad request  -> 400
 *   HC409  conflict     -> 409
 *   PGRST116  no rows from .single()
 */
export function dbError(error: PostgrestError, fallback = 500): HttpError {
  if (error.code === 'HC400') return new HttpError(400, error.message)
  if (error.code === 'HC409') return new HttpError(409, error.message)

  // Foreign key violation — almost always a reference to something deleted or
  // never created, which is the caller's problem rather than ours.
  if (error.code === '23503') {
    return new HttpError(400, 'That refers to something that no longer exists.')
  }

  // Unique violation.
  if (error.code === '23505') {
    return new HttpError(409, 'That already exists.')
  }

  // Check constraint — the database refusing something the schema forbids,
  // e.g. a negative batch quantity that slipped past validation.
  if (error.code === '23514') {
    return new HttpError(400, 'That value is not allowed.')
  }

  return new HttpError(fallback, error.message)
}

/**
 * Unwraps a Supabase result, throwing on error and on an unexpected null.
 *
 * Saves the same four lines in every handler, and makes "row not found" a 404
 * with a message rather than a null that reaches a mapper and explodes there.
 */
export function unwrap<T>(
  // `data: T` rather than `data: T | null`, so T infers as the row type
  // *including* its null and NonNullable can strip it. Written the other way,
  // T swallows the null and the return type stays nullable.
  result: { data: T; error: PostgrestError | null },
  notFound?: string,
): NonNullable<T> {
  if (result.error) throw dbError(result.error)

  if (result.data === null || result.data === undefined) {
    throw new HttpError(404, notFound ?? 'Not found.')
  }

  return result.data as NonNullable<T>
}

/** For list queries, where an empty result is a valid answer and not a 404. */
export function unwrapList<T>(result: {
  data: T[] | null
  error: PostgrestError | null
}): T[] {
  if (result.error) throw dbError(result.error)
  return result.data ?? []
}
