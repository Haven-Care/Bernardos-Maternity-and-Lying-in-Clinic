import { Router } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { accountRouter } from './account.routes.js'
import { systemRouter } from './system.routes.js'
import {
  clinicRouter,
  servicesRouter,
  slotsRouter,
} from './clinic.routes.js'
import { documentsRouter, patientsRouter } from './patients.routes.js'
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
apiRouter.get('/health/db', async (_req, res) => {
  try {
    const { error } = await getSupabaseClient()
      .from('services')
      .select('id')
      .limit(1)

    if (error) throw error
    res.json({ status: 'ok' })
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Supabase connection failed',
    })
  }
})

// Domain routers mount here as each phase lands.
apiRouter.use('/account', accountRouter)
apiRouter.use('/system', systemRouter)
apiRouter.use('/services', servicesRouter)
apiRouter.use('/slots', slotsRouter)
apiRouter.use('/clinic', clinicRouter)
apiRouter.use('/patients', patientsRouter)
apiRouter.use('/documents', documentsRouter)
apiRouter.use('/inventory', inventoryRouter)
apiRouter.use('/bookings', bookingsRouter)
apiRouter.use('/me', meRouter)
apiRouter.use('/reschedule-requests', rescheduleRequestsRouter)
apiRouter.use('/dashboard', dashboardRouter)
apiRouter.use('/notifications', notificationsRouter)
