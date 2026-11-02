import { Component, type ReactNode } from 'react'
import { Button } from './ui/Button'

/**
 * Last line of defence, outside the router. Route errors land on RouteError;
 * anything else — the toast provider, the router itself, or RouteError failing
 * in turn — would otherwise unmount the app and leave a blank page. Plain
 * markup only, because the router may be what failed. React already logs the
 * error to the console, so nothing is reported here.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex min-h-dvh items-center justify-center bg-brand-50/40 px-4 py-6">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-5 text-center shadow-sm sm:p-7">
          <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">Please reload the page. If the problem continues, return to sign in.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <a href="/login" className="py-2 text-sm font-semibold text-brand-700 underline">Return to sign in</a>
          </div>
        </div>
      </div>
    )
  }
}
