// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // React logs every caught error; keep the expected one out of the test output.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Broken(): never {
  throw new Error('render failed')
}

describe('AppErrorBoundary', () => {
  it('renders the app when nothing fails', async () => {
    await act(async () => root.render(<AppErrorBoundary><p>clinic app</p></AppErrorBoundary>))
    expect(container.textContent).toContain('clinic app')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('replaces a crashed app with a way back instead of a blank page', async () => {
    await act(async () => root.render(<AppErrorBoundary><Broken /></AppErrorBoundary>))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong')
    expect(container.querySelector('button')?.textContent).toContain('Reload page')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/login')
  })
})
