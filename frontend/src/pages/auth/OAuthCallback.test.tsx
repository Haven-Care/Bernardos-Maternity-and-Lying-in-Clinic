import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useAsync } from '../../hooks/useAsync'
import { ApiError } from '../../lib/api'
import { OAuthCallback } from './OAuthCallback'

vi.hoisted(() => { vi.stubGlobal('window', { location: { hostname: 'localhost' } }) })
vi.mock('../../api', () => ({}))
vi.mock('../../lib/supabase', () => ({}))
vi.mock('../../hooks/useAsync')

function render(error?: Error) {
  vi.mocked(useAsync).mockReturnValue({ data: undefined, error, loading: false, reload: vi.fn(), updateData: vi.fn() })
  return renderToStaticMarkup(<MemoryRouter><OAuthCallback /></MemoryRouter>)
}

describe('OAuth callback error messages', () => {
  it.each([403, 500])('does not expose server account details for status %s', (status) => {
    const markup = render(new ApiError(status, 'Staff account disabled: internal details'))
    expect(markup).not.toContain('Staff account disabled')
    expect(markup).toContain(status === 403 ? 'Invalid account' : 'Unable to sign in right now')
    expect(markup).toContain('Retry')
  })

  it('preserves friendly callback cancellation messages', () => {
    expect(render(new Error('Sign-in was cancelled. Please try again.'))).toContain('Sign-in was cancelled. Please try again.')
  })

  it('offers a fallback when no callback error is available', () => {
    expect(render()).toContain('Sign-in could not be completed. You can retry or return to sign in.')
  })
})
