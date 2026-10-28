// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, recoveryAuth, success } = vi.hoisted(() => ({
  auth: { getUser: vi.fn(), setSession: vi.fn(), signOut: vi.fn() },
  recoveryAuth: { getUser: vi.fn(), getSession: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() },
  success: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth }, recoverySupabase: { auth: recoveryAuth }, RECOVERY_USER_KEY: 'recovery-user', RECOVERY_RETURN_KEY: 'recovery-return' }))
vi.mock('../../api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../../api', async () => ({ account: await import('../../api/account') }))
vi.mock('../public/PublicShell', () => ({ PublicShell: ({ children }: { children: ReactNode }) => <main><nav>Patient portal</nav>{children}</main> }))
vi.mock('../../components/ui/toast-context', () => ({ useToast: () => ({ success, error: vi.fn() }) }))
import { cancelPasswordReset, recoveryEmail } from '../../api/account'
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard'
import { VerifyCode } from './VerifyCode'
import { ResetPassword } from './ResetPassword'
import { RecoveryCallback } from './RecoveryCallback'

let container: HTMLDivElement
let root: Root
let router: ReturnType<typeof createMemoryRouter>
const state = { email: 'patient@example.test', returnTo: '/patient/account' }
beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const user = { id: 'patient', email: state.email }
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  auth.setSession.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
  recoveryAuth.getUser.mockResolvedValue({ data: { user }, error: null })
  recoveryAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'verified-token', refresh_token: 'refresh-token' } }, error: null })
  recoveryAuth.verifyOtp.mockResolvedValue({ data: { user, session: { access_token: 'verified-token' } }, error: null })
  recoveryAuth.updateUser.mockResolvedValue({ error: null })
  recoveryAuth.signOut.mockResolvedValue({ error: null })
  await cancelPasswordReset()
  vi.clearAllMocks()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  router = createMemoryRouter([{ element: <UnsavedChangesGuard />, children: [
    { path: '/patient/account', element: <p>My profile</p> },
    { path: '/patient/verify-code', element: <VerifyCode /> },
    { path: '/patient/reset-password', element: <ResetPassword /> },
    { path: '/auth/recovery', element: <RecoveryCallback /> },
  ] }], { initialEntries: ['/patient/account', { pathname: '/patient/verify-code', state }] })
  await act(async () => root.render(<RouterProvider router={router} />))
})
afterEach(async () => { await act(() => root.unmount()); router.dispose(); container.remove(); vi.unstubAllGlobals() })
async function type(input: HTMLInputElement, value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function verify() {
  const digits = [...container.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')]
  expect(digits).toHaveLength(6)
  for (const [index, digit] of digits.entries()) await type(digit, String(index + 1))
  expect(router.state.location.pathname).toBe('/patient/reset-password')
  expect(container.textContent).toContain('Set your clinic password')
}

describe('patient password reset navigation', () => {
  it('keeps the patient portal visible and aborts a verified reset when Cancel is selected', async () => {
    expect(container.textContent).toContain('Patient portal')
    expect(container.textContent).not.toContain('Back to sign in')
    await verify()
    await act(() => container.querySelector<HTMLAnchorElement>('a[href="/patient/account"]')!.click())
    expect(router.state.location.pathname).toBe('/patient/account')
    expect(await recoveryEmail()).toBeNull()
    expect(recoveryAuth.updateUser).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    await act(async () => { await router.navigate('/patient/reset-password', { state }) })
    expect(router.state.location.pathname).toBe('/patient/account')
    expect(container.querySelector('input[type="password"]')).toBeNull()
  })
  it('aborts the verified reset when browser Back is used before typing a password', async () => {
    await verify()
    await act(async () => { await router.navigate(-1) })
    expect(router.state.location.pathname).toBe('/patient/verify-code')
    expect(await recoveryEmail()).toBeNull()
    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signOut).not.toHaveBeenCalled()
    await act(async () => { await router.navigate(1) })
    expect(router.state.location.pathname).toBe('/patient/account')
  })
  it('preserves Profile context and the existing login for an email-link reset', async () => {
    sessionStorage.setItem('recovery-user', 'patient')
    sessionStorage.setItem('recovery-return', '/patient/account')
    await act(async () => { await router.navigate('/auth/recovery') })
    expect(router.state.location.pathname).toBe('/patient/reset-password')
    expect(container.textContent).toContain('Patient portal')
    await act(() => container.querySelector<HTMLAnchorElement>('a[href="/patient/account"]')!.click())
    expect(router.state.location.pathname).toBe('/patient/account')
    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(await recoveryEmail()).toBeNull()
  })
  it('keeps verification valid if the patient chooses to stay with an unsaved password', async () => {
    await verify()
    await type(container.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')!, 'NewPassword1!')
    await act(() => container.querySelector<HTMLAnchorElement>('a[href="/patient/account"]')!.click())
    expect(container.textContent).toContain('Discard unsaved changes?')
    const stay = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Cancel')!
    await act(() => stay.click())
    expect(router.state.location.pathname).toBe('/patient/reset-password')
    expect(await recoveryEmail()).toBe(state.email)
    expect(recoveryAuth.signOut).not.toHaveBeenCalled()
  })
  it('returns to Profile after saving and retains the newly verified session', async () => {
    await verify()
    for (const input of container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')) await type(input, 'NewPassword1!')
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    await act(async () => submit.click())
    expect(recoveryAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1!' })
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'verified-token', refresh_token: 'refresh-token' })
    expect(router.state.location.pathname).toBe('/patient/account')
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(success).toHaveBeenCalled()
    expect(await recoveryEmail()).toBeNull()
  })
})
