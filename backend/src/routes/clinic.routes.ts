import { Router } from 'express'
import { optionalStaff, requireRole, requireStaff } from '../middleware/auth.js'
import { publicReadLimiter } from '../middleware/rateLimit.js'
import {
  createService,
  listServices,
  listServiceCatalog,
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
 *
 * Changing any of it is for administrators. Prices, open times, capacities and
 * booking limits are the clinic's policy; a staff account can read them in
 * the portal but not rewrite them. To let all staff edit again, replace
 * `adminOnly` with `requireStaff` on a route: it is the only thing that decides it.
 */
const adminOnly = [requireStaff, requireRole('administrator')]

// --- Services ---------------------------------------------------------------

export const servicesRouter = Router()

// Public, but scoped: `optionalStaff` means an anonymous caller sees only
// active services while staff see the deactivated ones too. One URL, and no
// way for the booking form to be shown something the clinic has withdrawn.
servicesRouter.get('/', publicReadLimiter, optionalStaff, listServices)
servicesRouter.get('/catalog', publicReadLimiter, listServiceCatalog)

servicesRouter.post('/', adminOnly, createService)
servicesRouter.patch('/:id', adminOnly, updateService)

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
slotsRouter.post('/', adminOnly, createSlot)
slotsRouter.patch('/:id', adminOnly, updateSlot)

// --- Clinic -----------------------------------------------------------------

export const clinicRouter = Router()

// Public: name, address, phone and opening hours are what the clinic puts on
// its own signage. The patient app's Contact Us screen reads exactly this.
clinicRouter.get('/', publicReadLimiter, getClinicInfo)
clinicRouter.get('/hours', publicReadLimiter, getOperatingHours)

clinicRouter.patch('/', adminOnly, updateClinicInfo)
clinicRouter.put('/hours', adminOnly, replaceOperatingHours)

// Staff only: near-expiry windows and booking ceilings are operational
// configuration, not public information.
clinicRouter.get('/settings', requireStaff, getSettings)
clinicRouter.patch('/settings', adminOnly, updateSettings)
