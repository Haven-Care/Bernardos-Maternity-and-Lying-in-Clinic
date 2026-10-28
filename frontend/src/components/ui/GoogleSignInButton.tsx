import { useEffect, useRef, useState } from 'react'
import { createGoogleNonce, loadGoogleIdentity } from '../../lib/googleIdentity'

interface Props {
  disabled?: boolean
  loading?: boolean
  onCredential: (credential: string, nonce: string) => Promise<void>
  onError: () => void
}

/** Google renders and operates its official button; no Supabase OAuth redirect. */
export function GoogleSignInButton({ disabled = false, loading = false, onCredential, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ disabled, loading, onCredential, onError })
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => { latest.current = { disabled, loading, onCredential, onError } })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let active = true
    let processing = false
    let observer: ResizeObserver | undefined

    async function initialize() {
      if (!host) return
      if (!clientId) throw new Error('Google client ID is not configured.')
      const [identity, { nonce, hashedNonce }] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
      if (!active) return
      identity.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        ux_mode: 'popup',
        auto_select: false,
        use_fedcm_for_button: true,
        callback: (response) => {
          if (!active || processing || latest.current.disabled || latest.current.loading) return
          processing = true
          void latest.current.onCredential(response.credential, nonce)
            .catch(() => { if (active) latest.current.onError() })
            .finally(() => {
              if (!active) return
              // Rotate the nonce before another credential can be exchanged.
              setPhase('loading')
              setAttempt((value) => value + 1)
            })
        },
      })
      let previousWidth = 0
      function render() {
        if (!active || !host) return
        const width = Math.min(400, Math.floor(host.getBoundingClientRect().width))
        if (width <= 0 || width === previousWidth) return
        previousWidth = width
        host.replaceChildren()
        identity.renderButton(host, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
          shape: 'rectangular', logo_alignment: 'left', width: String(width),
        })
      }
      render()
      observer = new ResizeObserver(render)
      observer.observe(host)
      setPhase('ready')
    }

    void initialize().catch(() => { if (active) setPhase('error') })
    return () => {
      active = false
      observer?.disconnect()
      host.replaceChildren()
    }
  }, [clientId, attempt])

  return (
    <div
      className="min-h-10 w-full"
      aria-busy={loading || undefined}
    >
      <div ref={hostRef} className="flex w-full justify-center" inert={disabled || loading} hidden={phase === 'error'} />
      {phase === 'loading' && <p role="status" className="text-center text-sm text-gray-500">Loading Google sign-in…</p>}
      {phase === 'error' && <div className="text-center text-sm">
        <p role="alert" className="text-danger-700">Google sign-in is unavailable. Try again later, or use Forgot password to set a clinic password.</p>
        {clientId && <button type="button" className="mt-1 text-brand-600 underline" onClick={() => { setPhase('loading'); setAttempt((value) => value + 1) }}>Retry Google sign-in</button>}
      </div>}
    </div>
  )
}
