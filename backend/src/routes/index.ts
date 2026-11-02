import { Router } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { loggableError } from '../middleware/errorHandler.js'
import { healthLimiter } from '../middleware/rateLimit.js'
import { accountRouter } from './account.routes.js'
import { systemRouter } from './system.routes.js'
import {
  clinicRouter,
  servicesRouter,
  slotsRouter,
} from './clinic.routes.js'
import { documentsRouter, patientAccountsRouter, patientsRouter } from './patients.routes.js'
import { inventoryRouter } from './inventory.routes.js'
import {
  bookingsRouter,
  meRouter,
  rescheduleRequestsRouter,
} from './appointments.routes.js'
import { dashboardRouter, notificationsRouter } from './dashboard.routes.js'

export const apiRouter = Router()

/** Liveness. Says the process is up; says nothing about the database. */
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

/**
 * Readiness.
 *
 * This previously called `supabase.auth.getSession()`, which reads *local*
 * session state. With `persistSession: false` there is none, so no network
 * request was ever made and the endpoint reported `ok` against a wrong URL, a
 * revoked key, or an empty database. It tested nothing.
 *
 * A trivial select actually crosses the wire and touches a table.
 */
apiRouter.get('/health/db', healthLimiter, async (_req, res) => {
  try {
    const { error } = await getSupabaseClient()
      .from('services')
      .select('id')
      .limit(1)

    if (error) throw error
    res.json({ status: 'ok' })
  } catch (err) {
    // Public route: the reason (a hostname, a revoked-key message) is for the
    // logs, never for whoever is probing it.
    console.error('Readiness check failed', loggableError(err))
    res.status(503).json({ status: 'error', message: 'Database unavailable.' })
  }
})

// Domain routers mount here as each phase lands.
apiRouter.use('/account', accountRouter)
apiRouter.use('/system', systemRouter)
apiRouter.use('/services', servicesRouter)
apiRouter.use('/slots', slotsRouter)
apiRouter.use('/clinic', clinicRouter)
apiRouter.use('/patients', patientsRouter)
apiRouter.use('/patient-accounts', patientAccountsRouter)
apiRouter.use('/documents', documentsRouter)
apiRouter.use('/inventory', inventoryRouter)
apiRouter.use('/bookings', bookingsRouter)
apiRouter.use('/me', meRouter)
apiRouter.use('/reschedule-requests', rescheduleRequestsRouter)
apiRouter.use('/dashboard', dashboardRouter)
apiRouter.use('/notifications', notificationsRouter)
