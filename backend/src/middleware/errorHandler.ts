import type { NextFunction, Request, Response } from 'express'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  // Anything that is not an HttpError was not written for the caller — a raw
  // Supabase error, a TypeError. Its message can name tables and columns, so it
  // is logged here and replaced.
  console.error(err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
