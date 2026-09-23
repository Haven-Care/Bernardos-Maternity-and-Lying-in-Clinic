import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AuthShell } from './AuthShell'
import { useAuthRealm } from './realm'

export function ResetSuccess() {
  const navigate = useNavigate()
  const realm = useAuthRealm()

  return (
    <AuthShell title="" subtitle="">
      {/*
        No negative margin. `AuthShell` renders nothing at all when the title is
        empty, so there is no gap for it to close — it only drags this block up
        into the logo, landing the tick on the clinic name.
      */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-700">
          <svg
            className="size-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>

        <h1 className="text-lg font-semibold text-gray-900">
          Password Successfully Reset
        </h1>
        <p className="text-sm text-gray-500">
          Your password has been updated. You can now log in with your new
          credentials{realm.isPatient ? '.' : ' to access the admin portal.'}
        </p>

        <Button
          className="mt-3 w-full"
          onClick={() => navigate(realm.loginPath, { replace: true })}
        >
          Log In
        </Button>
      </div>
    </AuthShell>
  )
}
