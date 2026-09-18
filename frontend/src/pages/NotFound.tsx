import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-500">
        That page doesn’t exist, or it hasn’t been built yet.
      </p>
      <Link
        to="/admin"
        className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
