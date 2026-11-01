import type { NextFunction, Request, Response } from 'express'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  // The path is not echoed: it is the caller's own input, and nothing about a
  // missing route is worth reflecting back.
  res.status(404).json({ error: 'Route not found.' })
}

/**
 * What may be logged about an unexpected error.
 *
 * Never the error object itself. body-parser attaches the raw request `body`,
 * which here is a patient's details, and Postgres errors carry `details` with
 * the failing row. Name, code and message say what broke without saying whose
 * record it was.
 */
export function loggableError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const { code, status } = err as Error & { code?: unknown; status?: unknown }
    return { name: err.name, message: err.message, code, status, stack: err.stack }
  }
  return { value: typeof err }
}

/** body-parser's 4xx failures, keyed by its `type`. */
const REQUEST_ERRORS: Record<string, string> = {
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request is too large.',
  'encoding.unsupported': 'The request encoding is not supported.',
  'charset.unsupported': 'The request character set is not supported.',
  'request.aborted': 'The request was interrupted.',
  'request.size.invalid': 'The request body did not match its declared size.',
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  // A body the parser refused is the caller's mistake, not a server fault, so
  // it gets its own 4xx instead of a 500 that would page someone.
  const { type, status } = (err ?? {}) as { type?: unknown; status?: unknown }
  if (typeof type === 'string' && type in REQUEST_ERRORS && typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: REQUEST_ERRORS[type] })
    return
  }

  // Anything that is not an HttpError was not written for the caller — a raw
  // Supabase error, a TypeError. Its message can name tables and columns, so it
  // is logged here and replaced.
  console.error('Unhandled error', { method: req.method, path: req.path, ...loggableError(err) })
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
