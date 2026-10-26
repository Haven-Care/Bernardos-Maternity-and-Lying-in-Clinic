import googleLogo from '../../assets/google-g.png'
import './GoogleSignInButton.css'

interface Props {
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}

/** Light button styling and logo from https://developers.google.com/identity/branding-guidelines. */
export function GoogleSignInButton({ disabled = false, loading = false, onClick }: Props) {
  return (
    <button
      type="button"
      className="google-sign-in-button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      <img src={googleLogo} alt="" width={20} height={20} />
      <span>Continue with Google</span>
      {loading && <span className="sr-only" role="status">Opening Google sign-in…</span>}
    </button>
  )
}
