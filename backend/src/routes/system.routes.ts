import { Router } from 'express'
import { requireRole, requireStaff } from '../middleware/auth.js'
import {
  getStaff,
  patchStaffStatus,
  postStaff,
} from '../controllers/system.controller.js'
import {
  listAuditLog,
  listPrivacyRequests,
  resolvePrivacyRequest,
} from '../controllers/privacy.controller.js'

export const systemRouter = Router()

// Applied to the whole router rather than per route, so a route added later
// cannot be left unguarded by forgetting to repeat it.
systemRouter.use(requireStaff, requireRole('administrator'))

systemRouter.get('/staff', getStaff)
systemRouter.post('/staff', postStaff)
systemRouter.patch('/staff/:id/status', patchStaffStatus)

// The clinic's Data Privacy Act duties: who accessed what, and answering
// patients' requests about their data. Administrators act for the clinic's DPO.
systemRouter.get('/audit-log', listAuditLog)
systemRouter.get('/privacy-requests', listPrivacyRequests)
systemRouter.post('/privacy-requests/:id/resolve', resolvePrivacyRequest)
