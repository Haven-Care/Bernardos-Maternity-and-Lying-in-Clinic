import { Router } from 'express'
import { requirePatient, requireStaff } from '../middleware/auth.js'
import { publicWriteLimiter } from '../middleware/rateLimit.js'
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  getBooking,
  getBookingByReference,
  listBookings,
  rescheduleBooking,
} from '../controllers/appointments.controller.js'
import {
  cancelMyBooking,
  createMyBooking,
  getMyAccount,
  listMyBookings,
  listMyRescheduleRequests,
  requestReschedule,
  updateMyAccount,
} from '../controllers/patientPortal.controller.js'
import {
  approveRescheduleRequest,
  declineRescheduleRequest,
  listRescheduleRequests,
} from '../controllers/rescheduleRequests.controller.js'

/**
 * Bookings.
 *
 * The one router with two audiences, so the split is made explicit rather than
 * left to be inferred from guards scattered through the file.
 */
export const bookingsRouter = Router()

/**
 * Creating a booking is the only write a patient makes here.
 *
 * Rate-limited even though it needs an account: sign-up is open, so "has an
 * account" is not a meaningful cost to an attacker, and every booking submitted
 * occupies a real slot in a real clinic's day.
 */
bookingsRouter.post('/', publicWriteLimiter, requirePatient, createMyBooking)

// Everything else on /bookings is the staff queue.
bookingsRouter.get('/', requireStaff, listBookings)
bookingsRouter.get('/reference/:referenceNo', requireStaff, getBookingByReference)
bookingsRouter.get('/:id', requireStaff, getBooking)
bookingsRouter.post('/:id/confirm', requireStaff, confirmBooking)
bookingsRouter.post('/:id/complete', requireStaff, completeBooking)
bookingsRouter.patch('/:id/reschedule', requireStaff, rescheduleBooking)
bookingsRouter.delete('/:id', requireStaff, cancelBooking)

/**
 * The patient's own surface.
 *
 * Mounted under /me and guarded once for the whole router. No route here takes
 * an account id — the JWT is the only thing that says whose data this is, which
 * is what makes asking for someone else's impossible rather than merely
 * refused.
 */
export const meRouter = Router()

meRouter.use(requirePatient)

meRouter.get('/account', getMyAccount)
meRouter.patch('/account', updateMyAccount)

meRouter.get('/bookings', listMyBookings)
meRouter.delete('/bookings/:id', cancelMyBooking)
meRouter.post('/bookings/:id/reschedule-request', requestReschedule)
meRouter.get('/reschedule-requests', listMyRescheduleRequests)

/** The staff approval queue for patient-initiated reschedules. */
export const rescheduleRequestsRouter = Router()

rescheduleRequestsRouter.use(requireStaff)

rescheduleRequestsRouter.get('/', listRescheduleRequests)
rescheduleRequestsRouter.post('/:id/approve', approveRescheduleRequest)
rescheduleRequestsRouter.post('/:id/decline', declineRescheduleRequest)
