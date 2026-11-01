import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { requestId } from './middleware/requestId.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  // Vercel overwrites X-Forwarded-For with the client IP. Trust only its
  // immediate proxy so rate limits use that IP instead of the proxy address.
  if (process.env.VERCEL === '1') app.set('trust proxy', 1)

  app.use(requestId)
  app.use(helmet())
  app.use(cors({ origin: env.corsOrigins }))
  // Express's default, stated: no request body this API accepts comes near it,
  // and a parser that buffers more is only a way to exhaust memory.
  app.use(express.json({ limit: '100kb' }))

  // Responses carry patient records and signed links. No browser or proxy
  // cache may keep a copy, on a shared front-desk PC least of all.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

// Vercel imports this entry point; server.ts owns the local listening socket.
export default createApp()
