import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AuthShell } from './auth/AuthShell'

/** Keep a recoverable screen visible if a route fails during navigation. */
export function RouteError() {
  return <AuthShell title="This page couldn’t load" subtitle="Please try again. If the problem continues, return to sign in.">
    <div className="flex flex-col gap-3">
      <Button onClick={() => window.location.reload()}>Reload page</Button>
      <Link to="/login" reloadDocument className="py-2 text-center text-sm font-semibold text-brand-700 underline">Return to sign in</Link>
    </div>
  </AuthShell>
}
