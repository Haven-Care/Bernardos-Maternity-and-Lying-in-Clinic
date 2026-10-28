// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookingRequest } from '../../../types/appointment'

const { listBookings, listSlots } = vi.hoisted(() => ({ listBookings: vi.fn(), listSlots: vi.fn() }))
vi.mock('../../../api', () => ({ appointments: { listBookings }, slots: { listSlots } }))
vi.mock('./BookingDetail', () => ({ BookingDetail: ({ booking, onClose, onChanged }: {
  booking: BookingRequest; onClose: () => void; onChanged: () => void
}) => <div role="dialog" aria-label="Appointment details">{booking.referenceNo}
  <button onClick={onClose}>Close details</button><button onClick={onChanged}>Refresh appointments</button>
</div> }))
import { AppointmentCalendar } from './AppointmentCalendar'

function booking(id: string, scheduledDate = '2026-10-28', slotTime = '08:00', status: BookingRequest['status'] = 'pending'): BookingRequest {
  return { id, referenceNo: `BR-${id}`, patientName: `Patient ${id}`, contactNumber: '09170000000',
    email: 'patient@example.test', patientId: null, serviceId: 'service', serviceName: 'Pre-natal Check-up',
    scheduledDate, slotTime, status, reasonForVisit: 'Check-up', submittedAt: '2026-10-27T08:00:00Z' }
}

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  listBookings.mockResolvedValue([
    booking('morning'), booking('afternoon', '2026-10-28', '17:30'),
    booking('tomorrow', '2026-10-29'), booking('sunday', '2026-11-01'),
    booking('cancelled', '2026-10-28', '08:00', 'cancelled'), booking('outside', '2026-11-10'),
  ])
  listSlots.mockResolvedValue([
    { id: 'wed', weekday: 'wednesday', time: '08:00', capacity: 2, isOpen: true },
    { id: 'thu', weekday: 'thursday', time: '09:00', capacity: 2, isOpen: true },
  ])
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function render() { await act(async () => { root.render(<AppointmentCalendar />) }) }
function button(label: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')]
    .find((element) => (element.getAttribute('aria-label') ?? element.textContent) === label)
  if (!found) throw new Error(`Missing button: ${label}`)
  return found
}
async function click(label: string) { await act(async () => button(label).click()) }
async function choose(value: string) {
  const input = container.querySelector<HTMLInputElement>('input')!
  await act(() => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })) })
}
function region() { return container.querySelector('[role="region"]')! }

describe('appointment calendar views', () => {
  it('defaults to a full week and retains appointments without a configured slot', async () => {
    await render()
    expect(button('Week').getAttribute('aria-pressed')).toBe('true')
    expect(region().getAttribute('aria-label')).toBe('Weekly appointment calendar')
    expect(region().querySelectorAll('thead th')).toHaveLength(8)
    expect(region().textContent).toContain('Patient sunday')
    expect(region().textContent).toContain('5:30 PM')
    expect(region().textContent).toContain('Patient afternoon')
    expect(region().textContent).not.toContain('Patient cancelled')
    expect(region().textContent).not.toContain('Patient outside')
  })

  it('switches to the actual selected day and only shows its appointments and slot times', async () => {
    await render()
    await click('Day')
    expect(container.querySelector('input')?.value).toBe('2026-10-28')
    expect(region().getAttribute('aria-label')).toBe('Daily appointment calendar')
    expect(region().textContent).toContain('Patient morning')
    expect(region().textContent).toContain('Patient afternoon')
    expect(region().textContent).not.toContain('Patient tomorrow')
    expect(region().textContent).not.toContain('9:00 AM')
    expect(region().textContent!.indexOf('Patient morning')).toBeLessThan(region().textContent!.indexOf('Patient afternoon'))
    await click('Next day')
    expect(container.querySelector('input')?.value).toBe('2026-10-29')
    expect(region().textContent).toContain('Patient tomorrow')
    await click('Today')
    expect(container.querySelector('input')?.value).toBe('2026-10-28')
  })

  it('shows a complete Monday-to-Sunday month grid and opens adjacent-month dates', async () => {
    await render()
    await click('Month')
    expect(container.querySelector('h2')?.textContent).toBe('October 2026')
    const dates = region().querySelectorAll('time')
    expect(dates).toHaveLength(35)
    expect(dates[0].dateTime).toBe('2026-09-28')
    expect(dates[34].dateTime).toBe('2026-11-01')
    expect(region().textContent).not.toContain('Patient cancelled')
    await click('View Nov 1, 2026')
    expect(button('Day').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('input')?.value).toBe('2026-11-01')
    expect(region().textContent).toContain('Patient sunday')
    expect(region().textContent).not.toContain('Patient morning')
  })

  it('expands a busy month date into a day with every appointment', async () => {
    listBookings.mockResolvedValue([booking('four', undefined, '11:00'), booking('three', undefined, '10:00'), booking('one'), booking('two', undefined, '09:00')])
    await render()
    await click('Month')
    expect(region().textContent).toContain('8:00 AM · Patient one')
    expect(region().textContent).not.toContain('Patient four')
    await click('View all 4 appointments on Oct 28, 2026')
    for (const name of ['one', 'two', 'three', 'four']) expect(region().textContent).toContain(`Patient ${name}`)
    const names = [...region().querySelectorAll('button[title]')].map((element) => element.textContent)
    expect(names).toEqual(['Patient onePre-natal Check-up', 'Patient twoPre-natal Check-up', 'Patient threePre-natal Check-up', 'Patient fourPre-natal Check-up'])
  })

  it.each(['Month', 'Week', 'Day'])('opens appointment details and reloads changes from %s view', async (view) => {
    await render()
    await click(view)
    const chip = [...region().querySelectorAll<HTMLButtonElement>('button[title]')].find((element) => element.textContent?.includes('Patient morning'))!
    await act(async () => chip.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('BR-morning')
    listBookings.mockResolvedValue([booking('updated')])
    await click('Refresh appointments')
    expect(listBookings).toHaveBeenCalledTimes(2)
    expect(region().textContent).toContain('Patient updated')
    await click('Close details')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('navigates weeks and drills into their date headers', async () => {
    await render()
    await click('Next week')
    expect(container.querySelector('input')?.value).toBe('2026-11-02')
    await click('Previous week')
    expect(container.querySelector('input')?.value).toBe('2026-10-26')
    await click('View Oct 29, 2026')
    expect(container.querySelector('input')?.value).toBe('2026-10-29')
    await click('Week')
    expect(container.querySelector('input')?.value).toBe('2026-10-26')
    await click('Next week')
    await click('This week')
    expect(container.querySelector('input')?.value).toBe('2026-10-26')
  })

  it('handles month-end, leap-year and year-boundary navigation', async () => {
    vi.setSystemTime(new Date('2028-01-31T12:00:00'))
    await render()
    await click('Month')
    await click('Next month')
    expect(container.querySelector('h2')?.textContent).toBe('February 2028')
    await click('Day')
    expect(container.querySelector('input')?.value).toBe('2028-02-29')
    await click('Month')
    await choose('2027-12')
    await click('Next month')
    expect(container.querySelector('h2')?.textContent).toBe('January 2028')
    await click('Previous month')
    expect(container.querySelector('h2')?.textContent).toBe('December 2027')
    await click('This month')
    expect(container.querySelector('input')?.value).toBe('2028-01')
  })

  it('lets staff pick dates directly and shows empty days without unrelated hours', async () => {
    await render()
    await choose('2026-11-10')
    expect(container.querySelector('input')?.value).toBe('2026-11-09')
    await click('Day')
    expect(region().textContent).toContain('Patient outside')
    await choose('2026-11-11')
    expect(region().textContent).toContain('No appointments for this day.')
    expect(region().textContent).toContain('8:00 AM')
    await click('Next day')
    await click('Next day')
    expect(region().textContent).toContain('No appointment slots configured for this day.')
    expect(region().textContent).not.toContain('8:00 AM')
  })

  it('renders all six rows when a month spans six weeks', async () => {
    await render()
    await click('Month')
    await choose('2026-11')
    expect(region().querySelectorAll('tbody tr')).toHaveLength(6)
    expect(region().querySelectorAll('time')).toHaveLength(42)
  })

  it('shows API errors with a working retry and keeps month usable if slots fail', async () => {
    listBookings.mockRejectedValueOnce(new Error('Appointments unavailable'))
    listSlots.mockRejectedValue(new Error('Slots unavailable'))
    await render()
    expect(container.textContent).toContain('Appointments unavailable')
    await click('Try again')
    expect(container.textContent).toContain('Slots unavailable')
    await click('Month')
    expect(region().textContent).toContain('Patient morning')
  })
})
