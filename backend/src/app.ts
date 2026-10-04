import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
  const app = express()

  // Vercel overwrites X-Forwarded-For with the client IP. Trust only its
  // immediate proxy so rate limits use that IP instead of the proxy address.
  if (process.env.VERCEL === '1') app.set('trust proxy', 1)

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

// Vercel imports this entry point; server.ts owns the local listening socket.
export default createApp()
