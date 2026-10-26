export interface GoogleIdentity {
  initialize(options: {
    client_id: string
    nonce: string
    callback: (response: { credential: string }) => void
    ux_mode: 'popup'
    auto_select: false
    use_fedcm_for_button: true
  }): void
  renderButton(parent: HTMLElement, options: {
    type: 'standard'
    theme: 'outline'
    size: 'large'
    text: 'continue_with'
    shape: 'rectangular'
    logo_alignment: 'left'
    width: string
  }): void
}

const SDK_URL = 'https://accounts.google.com/gsi/client'
let sdkPromise: Promise<GoogleIdentity> | undefined

function loadedIdentity(): GoogleIdentity | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id
}

/** Load once across React remounts; failed/blocked requests can be retried. */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = loadedIdentity()
  if (existing) return Promise.resolve(existing)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    const timeout = window.setTimeout(() => finish(), 15_000)

    function finish(identity?: GoogleIdentity) {
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      if (identity) resolve(identity)
      else {
        script.remove()
        reject(new Error('Google sign-in could not load. Check your connection and try again.'))
      }
    }

    script.onload = () => finish(loadedIdentity())
    script.onerror = () => finish()
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    sdkPromise = undefined
    throw error
  })
  return sdkPromise
}

/** Google receives SHA-256; Supabase verifies it against the original nonce. */
export async function createGoogleNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const hashedNonce = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { nonce, hashedNonce }
}
