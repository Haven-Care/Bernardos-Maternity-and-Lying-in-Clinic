import { Navigate } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AuthShell, BackToLogin } from './AuthShell'
import { LoadingState } from '../../components/ui/states'
import { RECOVERY_RETURN_KEY } from '../../lib/supabase'
import { recoveryReturnTo } from './realm'

export function RecoveryCallback() {
  const recovery = useAsync(() => api.account.recoveryEmail())
  if (recovery.loading) return <LoadingState label="Checking recovery link…" />
  const returnTo = recoveryReturnTo({ returnTo: sessionStorage.getItem(RECOVERY_RETURN_KEY) })
  if (recovery.data) return <Navigate to={returnTo ? '/patient/reset-password' : '/reset-password'} replace state={{ email: recovery.data, returnTo }} />
  return <AuthShell title="Recovery link unavailable" subtitle="This link may have expired or already been used." before={<BackToLogin />}>
    <a href="/forgot-password" className="font-semibold text-brand-700 underline">Request a new recovery email</a>
  </AuthShell>
}
