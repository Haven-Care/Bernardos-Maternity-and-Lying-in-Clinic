// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { getConsent, acceptNotice, logout } = vi.hoisted(() => ({ getConsent: vi.fn(), acceptNotice: vi.fn(), logout: vi.fn() }))
vi.mock('../api', () => ({ privacy: { getConsent, acceptNotice }, patientAuth: { logout } }))
import { ConsentGate } from './ConsentGate'

let container: HTMLDivElement
let root: Root
const status = (required: boolean, consentedVersion: string | null = null) =>
  ({ noticeVersion: 'v2', consentedVersion, consentedAt: consentedVersion ? '2026-01-01T00:00:00Z' : null, required })

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  getConsent.mockReset()
  acceptNotice.mockReset().mockResolvedValue(status(false, 'v2'))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><ConsentGate><p>patient area</p></ConsentGate></MemoryRouter>)
  })
}
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!

describe('ConsentGate', () => {
  it('lets a patient who already agreed straight through', async () => {
    getConsent.mockResolvedValue(status(false, 'v2'))
    await render()
    expect(container.textContent).toContain('patient area')
  })

  it('holds the app until the patient ticks the box and agrees', async () => {
    getConsent.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(status(false, 'v2'))
    await render()

    expect(container.textContent).not.toContain('patient area')
    expect(container.textContent).toContain('Before you continue')
    expect(button('Agree and continue').disabled).toBe(true)

    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    expect(button('Agree and continue').disabled).toBe(false)

    await act(async () => { button('Agree and continue').click() })
    expect(acceptNotice).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('patient area')
  })

  it('says so when the notice has changed since the patient last agreed', async () => {
    getConsent.mockResolvedValue(status(true, 'v1'))
    await render()
    expect(container.textContent).toContain('Our privacy notice has changed')
  })
})
