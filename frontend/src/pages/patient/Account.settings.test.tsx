// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { updateAccount, requestPasswordReset, confirmLeave, cancelLeave } = vi.hoisted(() => ({ updateAccount: vi.fn(), requestPasswordReset: vi.fn(), confirmLeave: vi.fn(), cancelLeave: vi.fn() }))
vi.mock('../../api', () => ({
  patientAuth: {
    getAccount: async () => ({ fullName: 'Test Patient', email: 'patient@example.test', contactNumber: '09171234567', emailNotifications: true }),
    updateAccount,
    requestPasswordReset,
  },
  clinic: { getClinicInfo: async () => ({ name: 'Test Clinic', address: 'Clinic address', mobile: '09171234567', landline: '', email: 'clinic@example.test' }) },
}))
vi.mock('../public/PublicShell', () => ({ PublicShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../../hooks/useUnsavedChanges', () => ({ useUnsavedChanges: () => {}, useConfirmLeave: () => ({ confirmLeave, cancelLeave }) }))
vi.mock('../../components/ui/toast-context', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
import { Account } from './Account'
let container: HTMLDivElement
let root: Root
function panel(title: string) { return [...container.querySelectorAll<HTMLButtonElement>('button[aria-controls]')].find((button) => button.textContent?.startsWith(title))! }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  updateAccount.mockReset().mockResolvedValue({})
  requestPasswordReset.mockReset().mockResolvedValue(undefined)
  confirmLeave.mockReset().mockResolvedValue(true)
  cancelLeave.mockReset()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>
}
function resetButton() { return [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Send verification code')! }
async function render() { await act(async () => { root.render(<MemoryRouter initialEntries={['/patient/account']}><Account /><LocationProbe /></MemoryRouter>); await Promise.resolve() }) }

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


describe('client password reset from Profile', () => {
  it('sends the registered email a code and opens verification without collecting passwords', async () => {
    await render()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    await act(async () => { resetButton().click() })
    expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith('patient@example.test')
    const location = JSON.parse(container.querySelector('[data-testid="location"]')!.textContent!)
    expect(location.pathname).toBe('/verify-code')
    expect(location.state.email).toBe('patient@example.test')
    expect(location.state.codeSentAt).toEqual(expect.any(Number))
  })
  it('stays on Profile and restores the unsaved-changes guard when email delivery fails', async () => {
    requestPasswordReset.mockRejectedValue(new Error('Email service unavailable'))
    await render()
    await act(async () => { resetButton().click() })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Email service unavailable')
    expect(container.querySelector('[data-testid="location"]')!.textContent).toContain('/patient/account')
    expect(cancelLeave).toHaveBeenCalledOnce()
    expect(resetButton().disabled).toBe(false)
  })
  it('does not send a code when the client chooses to keep unsaved changes', async () => {
    confirmLeave.mockResolvedValue(false)
    await render()
    await act(async () => { resetButton().click() })
    expect(requestPasswordReset).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="location"]')!.textContent).toContain('/patient/account')
  })
  it('sends only one request while an email request is pending', async () => {
    let complete!: () => void
    requestPasswordReset.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve }))
    await render()
    await act(async () => { resetButton().click(); resetButton().click() })
    expect(requestPasswordReset).toHaveBeenCalledTimes(1)
    expect(resetButton().disabled).toBe(true)
    await act(async () => { complete() })
  })
})
