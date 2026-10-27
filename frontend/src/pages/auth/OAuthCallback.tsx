import { Navigate, useSearchParams } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { loginDestination } from '../../lib/login'
import { Button } from '../../components/ui/Button'
import { AuthLoadingScreen } from '../../components/ui/AuthLoadingScreen'
import { AuthShell, BackToLogin } from './AuthShell'

export function OAuthCallback() {
  const [params] = useSearchParams()
  const session = useAsync(() => api.session.completeOAuthLogin())
  if (session.loading) return <AuthLoadingScreen />
  if (session.data) return <Navigate to={loginDestination(session.data.role, params.get('next'))} replace />
  return <AuthShell title="Sign-in unavailable" subtitle={session.error?.message ?? 'Sign-in could not be completed. You can retry or return to sign in.'} before={<BackToLogin />}>
    <Button onClick={session.reload}>Retry</Button>
  </AuthShell>
}
