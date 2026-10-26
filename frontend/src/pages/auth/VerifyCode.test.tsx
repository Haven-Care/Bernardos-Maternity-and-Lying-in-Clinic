import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { VerifyCode } from './VerifyCode'

vi.mock('../../api', () => ({ account: {} }))

describe('password recovery code form', () => {
  it.each(['/verify-code', '/patient/verify-code'])('renders all eight code digits at %s', (pathname) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname, state: { email: 'patient@example.test' } }]}>
        <VerifyCode />
      </MemoryRouter>,
    )

    expect(markup.match(/aria-label="Digit \d of 8"/g)).toHaveLength(8)
    expect(markup).toContain('8-digit code')
  })
})
