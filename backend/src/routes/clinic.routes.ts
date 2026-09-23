import { Router } from 'express'
import { optionalStaff, requireStaff } from '../middleware/auth.js'
import { publicReadLimiter } from '../middleware/rateLimit.js'
import {
  createService,
  listServices,
  updateService,
} from '../controllers/services.controller.js'
import {
  createSlot,
  listAvailability,
  listOpenWeekdays,
  listSlots,
  updateSlot,
} from '../controllers/slots.controller.js'
import {
  getClinicInfo,
  getOperatingHours,
  getSettings,
  replaceOperatingHours,
  updateClinicInfo,
  updateSettings,
} from '../controllers/clinic.controller.js'

/**
 * Services, slots and clinic details.
 *
 * These three share a file because they share a rule: *reading* them is partly
 * public, and *changing* them never is. The public booking form has to show
 * what the clinic offers, when it is open, and how to reach it, all before
 * anyone has an account.
 *
 * Each router below states which of its routes are reachable without a token,
 * because that is the decision worth being able to audit at a glance.
 */

// --- Services ---------------------------------------------------------------

export const servicesRouter = Router()

// Public, but scoped: `optionalStaff` means an anonymous caller sees only
// active services while staff see the deactivated ones too. One URL, and no
// way for the booking form to be shown something the clinic has withdrawn.
servicesRouter.get('/', publicReadLimiter, optionalStaff, listServices)

servicesRouter.post('/', requireStaff, createService)
servicesRouter.patch('/:id', requireStaff, updateService)

// --- Slots ------------------------------------------------------------------

export const slotsRouter = Router()

// Public: the booking form asks for a date's open times before sign-up, and
// for the set of weekdays worth offering at all. Both are things a patient can
// read off the clinic's door; neither exposes capacities or blocked slots.
slotsRouter.get('/availability', publicReadLimiter, listAvailability)
slotsRouter.get('/weekdays', publicReadLimiter, listOpenWeekdays)

// Staff only: the whole weekly grid, including blocked slots, is an
// Administration view.
slotsRouter.get('/', requireStaff, listSlots)
slotsRouter.post('/', requireStaff, createSlot)
slotsRouter.patch('/:id', requireStaff, updateSlot)

// --- Clinic -----------------------------------------------------------------

export const clinicRouter = Router()

// Public: name, address, phone and opening hours are what the clinic puts on
// its own signage. The patient app's Contact Us screen reads exactly this.
clinicRouter.get('/', publicReadLimiter, getClinicInfo)
clinicRouter.get('/hours', publicReadLimiter, getOperatingHours)

clinicRouter.patch('/', requireStaff, updateClinicInfo)
clinicRouter.put('/hours', requireStaff, replaceOperatingHours)

// Staff only: near-expiry windows and booking ceilings are operational
// configuration, not public information.
clinicRouter.get('/settings', requireStaff, getSettings)
clinicRouter.patch('/settings', requireStaff, updateSettings)
