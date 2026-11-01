// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { getIdentity } = vi.hoisted(() => ({ getIdentity: vi.fn() }))
vi.mock('../../../api', () => ({ session: { getIdentity } }))
vi.mock('./PatientAccounts', () => ({ PatientAccounts: () => <p>patient accounts panel</p> }))
vi.mock('./ServicesPricing', () => ({ ServicesPricing: () => <p>services panel</p> }))
vi.mock('./AppointmentSlots', () => ({ AppointmentSlots: () => <p>slots panel</p> }))
vi.mock('./ClinicInfo', () => ({ ClinicInfo: () => <p>clinic panel</p> }))
import { Administration } from './Administration'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(role: 'administrator' | 'staff', path = '/admin/administration') {
  getIdentity.mockResolvedValue({ role, userId: 'u' })
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}><Administration /></MemoryRouter>)
  })
}
const tabLabels = () => [...container.querySelectorAll('[role="tab"], a, button')].map((el) => el.textContent?.trim())

describe('Administration tabs', () => {
  it('shows administrators every settings tab', async () => {
    await render('administrator', '/admin/administration?tab=services')
    expect(tabLabels()).toEqual(expect.arrayContaining(['Patient Accounts', 'Services & Pricing', 'Appointment Slots', 'Clinic Info']))
    expect(container.textContent).toContain('services panel')
  })

  it('shows staff only what they may change, even when the URL names a settings tab', async () => {
    await render('staff', '/admin/administration?tab=services')
    expect(tabLabels()).toContain('Patient Accounts')
    expect(tabLabels()).not.toContain('Services & Pricing')
    expect(container.textContent).not.toContain('services panel')
    expect(container.textContent).toContain('patient accounts panel')
    expect(container.textContent).toContain('changed by an administrator')
  })
})
