import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    /** One id per request, in the response header, logs and the audit log. */
    requestId: string
  }
}

// Vercel's own id when the request came through it, so a line in the audit
// log can be matched to the platform's request log. Anything else a client
// sends in that header is ignored unless it looks like one.
const VERCEL_ID = /^[a-z0-9:-]{8,128}$/i

export function requestId(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.get('x-vercel-id')
  req.requestId = forwarded && VERCEL_ID.test(forwarded) ? forwarded : randomUUID()
  res.set('X-Request-Id', req.requestId)
  next()
}
