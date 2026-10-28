// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Service } from '../types/service'

const { listServiceCatalog } = vi.hoisted(() => ({ listServiceCatalog: vi.fn() }))
vi.mock('../api', () => ({ services: { listServiceCatalog } }))
import { ClinicServiceCatalog } from './ClinicServiceCatalog'

let container: HTMLDivElement
let root: Root
let services: Service[]
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  services = [
    { id: 'prenatal', name: 'Pre-natal Check-up (first visit)', category: 'Check-ups', price: 275, active: true },
    { id: 'norifam', name: 'Norifam', category: 'Family planning', price: 800, active: true },
    { id: 'hearing', name: 'Hearing Test', category: 'Maternity & newborn', price: 700, active: false },
  ]
  listServiceCatalog.mockReset().mockImplementation(async () => services.map((service) => ({ ...service })))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function render() { await act(async () => root.render(<ClinicServiceCatalog />)) }
async function all() { await act(() => [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'All')!.click()) }

describe('patient clinic service prices', () => {
  it('uses saved API rates instead of the static clinic reference prices', async () => {
    await render(); await all()
    expect(container.textContent).toContain('₱275')
    expect(container.textContent).toContain('₱800')
    expect(container.textContent).not.toContain('Contact clinic for price')
    expect(container.textContent).toContain('Hearing Test')
    expect(container.textContent).toContain('Currently unavailable')
    expect(container.textContent).toContain('₱700')
    expect(container.textContent).toContain('Browse 3 services')
  })
  it('shows newly configured services and categories from the API', async () => {
    services.push({ id: 'new', name: 'New consultation', category: 'New category', price: null, active: true })
    await render(); await all()
    expect(container.textContent).toContain('New consultation')
    expect(container.textContent).toContain('Contact clinic for price')
    expect(container.querySelector('button[aria-pressed="false"]')?.textContent).toBeDefined()
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'New category')).toBe(true)
  })
  it('refreshes prices and availability when the patient returns to the tab', async () => {
    await render(); await all()
    services = [{ ...services[0], price: 350 }, { ...services[1], active: false }]
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.textContent).toContain('₱350')
    expect(container.textContent).not.toContain('₱275')
    expect(container.textContent).toContain('Norifam')
    expect(container.textContent).toContain('Currently unavailable')
  })
  it('shows a retry error instead of substituting static prices when the API fails', async () => {
    listServiceCatalog.mockRejectedValue(new Error('Rates unavailable'))
    await render()
    expect(container.textContent).toContain('Rates unavailable')
    expect(container.textContent).not.toContain('₱2,500')
    expect(container.textContent).not.toContain('Normal Deliveries')
  })
})
