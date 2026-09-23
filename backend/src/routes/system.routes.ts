import { Router } from 'express'
import { requireRole, requireStaff } from '../middleware/auth.js'
import {
  getStaff,
  patchStaffStatus,
  postStaff,
} from '../controllers/system.controller.js'

export const systemRouter = Router()

// Applied to the whole router rather than per route, so a route added later
// cannot be left unguarded by forgetting to repeat it.
systemRouter.use(requireStaff, requireRole('administrator'))

systemRouter.get('/staff', getStaff)
systemRouter.post('/staff', postStaff)
systemRouter.patch('/staff/:id/status', patchStaffStatus)
