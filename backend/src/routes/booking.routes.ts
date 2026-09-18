import { Router } from 'express'
import {
  cancelBooking,
  createBooking,
  getBooking,
  listBookings,
  updateBooking,
} from '../controllers/booking.controller.js'

export const bookingRouter = Router()

bookingRouter.get('/', listBookings)
bookingRouter.get('/:id', getBooking)
bookingRouter.post('/', createBooking)
bookingRouter.patch('/:id', updateBooking)
bookingRouter.delete('/:id', cancelBooking)
