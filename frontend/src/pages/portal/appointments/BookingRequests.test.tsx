import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsync } from '../../../hooks/useAsync'
import type { BookingRequest } from '../../../types/appointment'
import { BookingRequests } from './BookingRequests'
import { clinicDate } from '../../../lib/dateRange'

vi.mock('../../../api', () => ({}))
vi.mock('../../../hooks/useAsync')
vi.mock('../patients/PatientModal', () => ({ PatientModal: () => null }))

function booking(id: string, scheduledDate: string, slotTime: string, submittedAt: string): BookingRequest {
  return { id, referenceNo: id, scheduledDate, slotTime, submittedAt, patientId: null,
    patientName: 'Test patient', contactNumber: '09170000000', email: 'patient@example.test',
    serviceId: 'service', serviceName: 'Pre-natal Check-up', status: 'pending', reasonForVisit: 'Check-up' }
}

describe('appointment list default ordering', () => {
  beforeEach(() => { vi.resetAllMocks() })

  function render(rows: BookingRequest[], visits = false) {
    vi.mocked(useAsync).mockReturnValue({ data: rows, loading: false, error: undefined, reload: vi.fn(), updateData: vi.fn() })
    return renderToStaticMarkup(<BookingRequests visits={visits} />)
  }

  it('orders by appointment date and time descending even when submission dates disagree', () => {
    const markup = render([
      booking('OLDER-DATE', '2026-10-27', '15:00', '2026-10-26T10:00:00Z'),
      booking('LATEST-EARLY', '2026-10-28', '08:00', '2026-10-23T10:00:00Z'),
      booking('LATEST-LATE', '2026-10-28', '14:00', '2026-10-22T10:00:00Z'),
    ])
    expect(markup).toContain('value="latest-appointment" selected=""')
    expect(markup.indexOf('LATEST-LATE')).toBeLessThan(markup.indexOf('LATEST-EARLY'))
    expect(markup.indexOf('LATEST-EARLY')).toBeLessThan(markup.indexOf('OLDER-DATE'))
  })

  it('keeps today’s visit queue in chronological order', () => {
    const today = clinicDate(new Date().toISOString())
    const markup = render([
      booking('AFTERNOON', today, '14:00', '2026-10-26T10:00:00Z'),
      booking('MORNING', today, '08:00', '2026-10-22T10:00:00Z'),
    ], true)
    expect(markup).toContain('value="appointment" selected=""')
    expect(markup.indexOf('MORNING')).toBeLessThan(markup.indexOf('AFTERNOON'))
  })
})
