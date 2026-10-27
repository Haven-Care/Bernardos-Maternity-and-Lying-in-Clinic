import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DetailsStep } from './DetailsStep'

describe('personal detail saving consent', () => {
  it.each([false, true])('renders the patient’s explicit choice (%s)', (savePersonalDetails) => {
    const markup = renderToStaticMarkup(<DetailsStep
      value={{ patientName: 'Patient', contactNumber: '09170000000', email: 'patient@example.test', reasonForVisit: '' }}
      onChange={vi.fn()} savePersonalDetails={savePersonalDetails} onSavePersonalDetailsChange={vi.fn()}
      service={{ id: 'service', name: 'Consultation', category: 'Consultation', price: 500, active: true }}
      scheduledDate="2026-11-03" slotTime="09:00" onContinue={vi.fn()}
    />)
    const checkbox = markup.match(/<input\b[^>]*type="checkbox"[^>]*>/)?.[0]
    expect(checkbox).toBeDefined()
    expect(checkbox?.includes('checked=""')).toBe(savePersonalDetails)
    expect(markup).toContain('Save my name and mobile number for future bookings')
    expect(markup).toContain('Service, schedule, and reason for visit won’t be reused.')
  })
})
