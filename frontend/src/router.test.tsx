import { renderToStaticMarkup } from 'react-dom/server'
import { RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsync } from './hooks/useAsync'
import { ApiError } from './lib/api'
import { router } from './router'

const { redirect } = vi.hoisted(() => {
  vi.stubGlobal('window', { location: { hostname: 'localhost' } })
  return { redirect: vi.fn() }
})

vi.mock('./api', () => ({}))
vi.mock('./lib/supabase', () => ({}))
vi.mock('./hooks/useAsync')
vi.mock('./components/UnsavedChangesGuard', async () => {
  const { Outlet } = await import('react-router-dom')
  return { UnsavedChangesGuard: Outlet }
})
vi.mock('./pages/public/BookingPage', () => ({
  BookingPage: () => <div>Patient booking form</div>,
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    createBrowserRouter: (routes: Parameters<typeof original.createBrowserRouter>[0]) =>
      original.createMemoryRouter(routes, { initialEntries: ['/book?step=2'] }),
    // Server rendering cannot run Navigate's effect; inspect its redirect props.
    Navigate: (props: unknown) => { redirect(props); return null },
  }
})

function session(state: { loading?: boolean; error?: Error; role?: 'patient' | 'staff' | 'administrator' } = {}) {
  vi.mocked(useAsync).mockReturnValue({
    loading: state.loading ?? false,
    error: state.error,
    data: state.role ? { role: state.role } : undefined,
    reload: vi.fn(),
    updateData: vi.fn(),
  })
  return renderToStaticMarkup(<RouterProvider router={router} />)
}

describe('booking route authentication', () => {
  beforeEach(() => { redirect.mockClear() })

  it('hides the booking form until the session check finishes', () => {
    expect(session({ loading: true })).toContain('Checking your session')
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([undefined, 401, 403, 404])('sends a missing or rejected session (%s) to login', (status) => {
    expect(session({ error: status ? new ApiError(status, 'Sign in required') : undefined }))
      .not.toContain('Patient booking form')
    expect(redirect).toHaveBeenCalledWith(expect.objectContaining({
      to: '/login', replace: true, state: { from: '/book?step=2' },
    }))
  })

  it('renders the booking form for a signed-in patient', () => {
    expect(session({ role: 'patient' })).toContain('Patient booking form')
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each(['staff', 'administrator'] as const)('sends a %s account to the staff portal', (role) => {
    expect(session({ role })).not.toContain('Patient booking form')
    expect(redirect).toHaveBeenCalledWith(expect.objectContaining({ to: '/admin', replace: true }))
  })

  it('offers retry on a connection failure without exposing the booking form', () => {
    const markup = session({ error: new TypeError('Failed to fetch') })
    expect(markup).toContain('Try again')
    expect(markup).not.toContain('Patient booking form')
    expect(redirect).not.toHaveBeenCalled()
  })
})
