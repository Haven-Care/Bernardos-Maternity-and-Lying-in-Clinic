import { Router } from 'express'
import { requireStaff } from '../middleware/auth.js'
import {
  getAppointmentsOverview,
  getStats,
  getUrgentAlerts,
  listNotifications,
} from '../controllers/dashboard.controller.js'

/**
 * The staff Dashboard.
 *
 * Staff only, all of it — the tiles count the clinic's whole book of business
 * and the alerts name stock levels, neither of which a patient sees.
 */
export const dashboardRouter = Router()

dashboardRouter.use(requireStaff)

dashboardRouter.get('/stats', getStats)
dashboardRouter.get('/appointments-overview', getAppointmentsOverview)
dashboardRouter.get('/alerts', getUrgentAlerts)

/**
 * The header dropdown.
 *
 * Mounted at the top level rather than under /dashboard because the bell is in
 * the portal header on every screen, not on the Dashboard — the contract's
 * marker reads `/notifications`.
 */
export const notificationsRouter = Router()

notificationsRouter.use(requireStaff)

notificationsRouter.get('/', listNotifications)
