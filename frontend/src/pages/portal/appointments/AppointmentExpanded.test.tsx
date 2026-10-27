import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookingRequest } from '../../../types/appointment'
import { useAsync } from '../../../hooks/useAsync'
import { AppointmentExpanded } from './AppointmentExpanded'

vi.mock('../../../api', () => ({ patients: {} }))
vi.mock('../../../hooks/useAsync')
vi.mock('../patients/PatientModal', () => ({ PatientModal: () => null }))

const booking: BookingRequest = {
  id: 'booking', referenceNo: 'BR-1000', patientId: 'patient', patientName: 'Booking name',
  contactNumber: '09170000000', email: 'booking@example.test', serviceId: 'service',
  serviceName: 'Consultation', scheduledDate: '2026-10-28', slotTime: '09:00',
  status: 'confirmed', reasonForVisit: 'Routine check-up', submittedAt: '2026-10-27T08:00:00Z',
}

function render(value = booking) {
  return renderToStaticMarkup(<AppointmentExpanded booking={value} onManage={vi.fn()} />)
}

describe('appointment and patient details', () => {
  beforeEach(() => {
    vi.mocked(useAsync).mockReturnValue({
      loading: false, error: undefined, reload: vi.fn(), updateData: vi.fn(),
      data: { patientCode: 'P-001', fullName: 'Current patient name', email: 'current@example.test', contactNumber: '09170000001', dateOfBirth: null, bloodType: null, address: '', allergies: '', medicalConditions: '', attendingPhysician: '', lastVisit: null, emergencyContactName: '', emergencyContactNumber: '' },
    })
  })

  it('distinguishes booking contact details from the current patient record', () => {
    const markup = render()
    for (const value of ['Booking name', 'booking@example.test', 'Current patient name', 'current@example.test', 'P-001', 'Routine check-up', 'Manage appointment', 'Open patient record']) {
      expect(markup).toContain(value)
    }
    expect(markup).toContain('Not recorded')
  })

  it('keeps appointment details available when no patient record is linked', () => {
    vi.mocked(useAsync).mockReturnValueOnce({ loading: false, error: undefined, data: null, reload: vi.fn(), updateData: vi.fn() })
    const markup = render({ ...booking, patientId: null })
    expect(markup).toContain('No patient record is linked')
    expect(markup).toContain('Routine check-up')
    expect(markup).not.toContain('Open patient record')
  })

  it('shows a retry without hiding appointment details when the patient request fails', () => {
    vi.mocked(useAsync).mockReturnValueOnce({ loading: false, error: new Error('Patient record unavailable'), data: undefined, reload: vi.fn(), updateData: vi.fn() })
    const markup = render()
    expect(markup).toContain('Patient record unavailable')
    expect(markup).toContain('Try again')
    expect(markup).toContain('Routine check-up')
    expect(markup).not.toContain('Open patient record')
  })
})
