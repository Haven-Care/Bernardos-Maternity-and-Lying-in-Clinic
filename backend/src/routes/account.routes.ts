import { Router } from 'express'
import { requireStaff } from '../middleware/auth.js'
import {
  getMe,
  getNotificationPrefs,
  updateMe,
  updateNotificationPrefs,
} from '../controllers/account.controller.js'

export const accountRouter = Router()

// Every route here is about the caller's own account, so the guard is the whole
// authorization story — there is no id in any path to get wrong.
accountRouter.use(requireStaff)

accountRouter.get('/me', getMe)
accountRouter.patch('/me', updateMe)

accountRouter.get('/notifications', getNotificationPrefs)
accountRouter.patch('/notifications', updateNotificationPrefs)
