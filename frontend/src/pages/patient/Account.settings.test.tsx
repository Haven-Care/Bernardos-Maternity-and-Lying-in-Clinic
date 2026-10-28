// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { updateAccount } = vi.hoisted(() => ({ updateAccount: vi.fn() }))
vi.mock('../../api', () => ({
  patientAuth: {
    getAccount: async () => ({ fullName: 'Test Patient', email: 'patient@example.test', contactNumber: '09171234567', emailNotifications: true }),
    updateAccount,
  },
  clinic: { getClinicInfo: async () => ({ name: 'Test Clinic', address: 'Clinic address', mobile: '09171234567', landline: '', email: 'clinic@example.test' }) },
}))
vi.mock('../public/PublicShell', () => ({ PublicShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../../hooks/useUnsavedChanges', () => ({ useUnsavedChanges: () => {}, useConfirmLeave: () => ({ confirmLeave: async () => true, cancelLeave: () => {} }) }))
vi.mock('../../components/ui/toast-context', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
import { Account } from './Account'
let container: HTMLDivElement
let root: Root
function panel(title: string) { return [...container.querySelectorAll<HTMLButtonElement>('button[aria-controls]')].find((button) => button.textContent?.startsWith(title))! }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  updateAccount.mockReset().mockResolvedValue({})
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function render() { await act(async () => { root.render(<MemoryRouter><Account /></MemoryRouter>); await Promise.resolve() }) }

describe('patient mobile settings', () => {
  it('shows all five sections and expands each mobile panel independently', async () => {
    await render()
    const titles = ['Personal Information', 'Password Management', 'Notification Settings', 'Contact Us', 'Help & FAQs']
    for (const title of titles) expect(panel(title)).toBeDefined()
    expect(panel('Personal Information').getAttribute('aria-expanded')).toBe('false')
    for (const title of titles.slice(1)) expect(panel(title).getAttribute('aria-expanded')).toBe('false')
    await act(() => panel('Help & FAQs').click())
    expect(panel('Help & FAQs').getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(panel('Help & FAQs').getAttribute('aria-controls')!)!.hidden).toBe(false)
    expect(container.textContent).toContain('What does Booked mean?')
  })
  it('saves only notification preferences from the dedicated notification section', async () => {
    await render()
    await act(() => panel('Notification Settings').click())
    await act(() => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click())
    const save = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Save notification settings')!
    expect(save.disabled).toBe(false)
    await act(async () => { save.click(); await Promise.resolve() })
    expect(updateAccount).toHaveBeenCalledExactlyOnceWith({ emailNotifications: false })
    expect(save.disabled).toBe(true)
  })
  it('shows clinic call and email links and preserves all expanded panels on desktop', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    await render()
    for (const title of ['Personal Information', 'Password Management', 'Notification Settings', 'Contact Us', 'Help & FAQs']) expect(panel(title).getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('a[href="tel:09171234567"]')).not.toBeNull()
    expect(container.querySelector('a[href="mailto:clinic@example.test"]')).not.toBeNull()
  })
})
