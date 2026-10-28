import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { VerifyCode } from './VerifyCode'

vi.mock('../../api', () => ({ account: {} }))
vi.mock('../public/PublicShell', () => ({ PublicShell: () => null }))

describe('password recovery code form', () => {
  it.each(['/verify-code', '/patient/verify-code'])('renders exactly six code digits at %s', (pathname) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname, state: { email: 'patient@example.test' } }]}>
        <VerifyCode />
      </MemoryRouter>,
    )

    expect(markup.match(/aria-label="Digit \d of 6"/g)).toHaveLength(6)
    expect(markup.match(/<input\b/g)).toHaveLength(6)
    expect(markup).toContain('6-digit code')
  })
})
