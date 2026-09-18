import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AuthShell } from './AuthShell'

export function ResetSuccess() {
  const navigate = useNavigate()

  return (
    <AuthShell title="" subtitle="">
      <div className="-mt-10 flex flex-col items-center gap-3 text-center">
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
          credentials to access the admin portal.
        </p>

        <Button
          className="mt-3 w-full"
          onClick={() => navigate('/login', { replace: true })}
        >
          Log In
        </Button>
      </div>
    </AuthShell>
  )
}
