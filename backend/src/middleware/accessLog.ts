import type { NextFunction, Request, Response } from 'express'

/**
 * One JSON line per finished request, for the platform's log search.
 *
 * Method, route, status, duration and request id only. Never the query string,
 * body or headers: paths can carry ids and queries can carry names, and none of
 * that belongs in a log. `req.route.path` is the pattern ("/patients/:id"), so
 * ids in the URL are not logged either; unmatched requests log no path.
 */
export function accessLog(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint()
  res.on('finish', () => {
    const route = req.route?.path
    console.info(
      JSON.stringify({
        msg: 'request',
        requestId: req.requestId,
        method: req.method,
        route: typeof route === 'string' ? `${req.baseUrl}${route}` : undefined,
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10,
      }),
    )
  })
  next()
}
