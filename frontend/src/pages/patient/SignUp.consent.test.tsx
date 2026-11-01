// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('../../api', () => ({ patientAuth: { signUp } }))
import { SignUp } from './SignUp'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  signUp.mockReset().mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function type(label: string, value: string) {
  const field = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!
  const input = (field.control ?? container.querySelector(`#${field.htmlFor}`)) as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function fillAndSubmit() {
  await act(async () => {
    type('Full name', 'Juana Dela Cruz')
    type('Email address', 'juana@example.test')
    type('Mobile number', '09171234567')
    type('Password', 'Sup3rSecret!')
    type('Confirm password', 'Sup3rSecret!')
  })
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('sign-up consent', () => {
  it('starts unticked and sends nothing until the privacy notice is accepted', async () => {
    await act(async () => root.render(<MemoryRouter><SignUp /></MemoryRouter>))
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(box.checked).toBe(false)

    await fillAndSubmit()

    expect(signUp).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Please read and accept the Privacy Notice')
  })

  it('links the notice and passes the acceptance on', async () => {
    await act(async () => root.render(<MemoryRouter><SignUp /></MemoryRouter>))
    expect(container.querySelector('a[href="/privacy"]')).not.toBeNull()

    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await fillAndSubmit()

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'juana@example.test', acceptedPrivacyNotice: true }))
  })
})
