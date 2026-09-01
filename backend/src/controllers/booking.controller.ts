import type { Request, Response } from 'express'
import type { Booking } from '../types/booking.js'

export function listBookings(_req: Request, res: Response) {
  const bookings: Booking[] = []
  res.json(bookings)
}

export function getBooking(req: Request, res: Response) {
  res.status(404).json({ error: `Booking not found: ${req.params.id}` })
}

export function createBooking(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}

export function updateBooking(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}

export function cancelBooking(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}
