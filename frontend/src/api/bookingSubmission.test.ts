import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookingRequest, CreateBookingInput } from '../types/appointment'
import { createBooking } from './appointments'
import { updateAccount } from './patientAuth'
import { submitBooking } from './bookingSubmission'

vi.mock('./appointments', () => ({ createBooking: vi.fn() }))
vi.mock('./patientAuth', () => ({ updateAccount: vi.fn() }))

const input: CreateBookingInput = {
  patientName: 'Updated patient', contactNumber: '09170000000',
  serviceId: 'service', scheduledDate: '2026-11-03', slotTime: '09:00', reasonForVisit: 'Routine check-up',
}
const booking: BookingRequest = {
  ...input, id: 'booking', referenceNo: 'BR-1000', patientId: 'patient',
  patientName: 'Updated patient', contactNumber: '09170000000', email: 'patient@example.test',
  serviceName: 'Consultation', status: 'pending', submittedAt: '2026-10-27T08:00:00Z',
}
const profile = {
  id: 'patient', fullName: booking.patientName, contactNumber: booking.contactNumber,
  email: booking.email, emailNotifications: true, createdAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(createBooking).mockResolvedValue(booking)
  vi.mocked(updateAccount).mockResolvedValue(profile)
})

describe('saving personal details while booking', () => {
  it.each([undefined, false])('does not update a profile without consent (%s)', async (consent) => {
    expect(await submitBooking(input, consent)).toEqual({ booking })
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('saves only name and mobile number after a successful booking', async () => {
    expect(await submitBooking(input, true)).toEqual({ booking, profile })
    expect(createBooking).toHaveBeenCalledWith(input)
    expect(updateAccount).toHaveBeenCalledWith({ fullName: booking.patientName, contactNumber: booking.contactNumber })
    expect(vi.mocked(createBooking).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(updateAccount).mock.invocationCallOrder[0])
  })

  it('does not save details when the booking is rejected', async () => {
    vi.mocked(createBooking).mockRejectedValue(new Error('That time was just filled.'))
    await expect(submitBooking(input, true)).rejects.toThrow('That time was just filled.')
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('keeps a successful booking confirmed if saving the profile fails', async () => {
    vi.mocked(updateAccount).mockRejectedValue(new Error('Connection lost'))
    expect(await submitBooking(input, true)).toEqual({ booking, detailsSaveFailed: true })
    expect(createBooking).toHaveBeenCalledTimes(1)
  })
})
