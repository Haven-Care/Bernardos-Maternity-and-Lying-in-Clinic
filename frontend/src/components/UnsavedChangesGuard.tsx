import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useBeforeUnload, useBlocker, useLocation } from 'react-router-dom'
import { cancelPasswordReset } from '../api/account'
import { UnsavedChangesContext } from '../hooks/useUnsavedChanges'
import { ConfirmModal } from './ui/Modal'

export function UnsavedChangesGuard() {
  const [forms, setForms] = useState<ReadonlySet<string>>(new Set())
  const register = useCallback((id: string, dirty: boolean) => {
    setForms((current) => {
      if (current.has(id) === dirty) return current
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  const dirty = forms.size > 0
  const approved = useRef(false)
  const pendingLeave = useRef<((approved: boolean) => void) | null>(null)
  const [askingToLeave, setAskingToLeave] = useState(false)
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  useEffect(() => { approved.current = false }, [location.key])
  useEffect(() => {
    const resetPaths = ['/reset-password', '/patient/reset-password']
    const recoveryPaths = [...resetPaths, '/verify-code', '/patient/verify-code', '/auth/recovery']
    const leftPasswordForm = resetPaths.includes(previousPath.current) && previousPath.current !== location.pathname
    previousPath.current = location.pathname
    if (leftPasswordForm || !recoveryPaths.includes(location.pathname)) {
      // Clear authorization even when no password has been typed. Going back
      // must never restore a previously verified password-reset form.
      void cancelPasswordReset().catch(() => { /* Local recovery authorization is already cleared. */ })
    }
  }, [location.pathname])
  useEffect(() => {
    const cancel = () => { void cancelPasswordReset().catch(() => {}) }
    window.addEventListener('pagehide', cancel)
    return () => window.removeEventListener('pagehide', cancel)
  }, [])
  const confirmLeave = useCallback(async () => {
    if (!dirty) { approved.current = true; return true }
    // Ignore repeated requests while the original caller awaits a decision.
    if (pendingLeave.current) return false
    setAskingToLeave(true)
    return new Promise<boolean>((resolve) => { pendingLeave.current = resolve })
  }, [dirty])
  const cancelLeave = useCallback(() => { approved.current = false }, [])
  const blocker = useBlocker(() => dirty && !approved.current)
  useEffect(() => () => { pendingLeave.current?.(false) }, [])
  function decideLeave(leave: boolean) {
    if (pendingLeave.current) {
      approved.current = leave
      pendingLeave.current(leave)
      pendingLeave.current = null
      setAskingToLeave(false)
    } else if (blocker.state === 'blocked') {
      if (leave) blocker.proceed()
      else blocker.reset()
    }
  }
  useBeforeUnload(useCallback((event) => {
    if (!dirty || approved.current) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))

  return <UnsavedChangesContext.Provider value={{ register, confirmLeave, cancelLeave }}>
    <Outlet />
    <ConfirmModal open={askingToLeave || blocker.state === 'blocked'} onClose={() => decideLeave(false)} onConfirm={() => decideLeave(true)}
      title="Discard unsaved changes?" message="Your unsaved changes will be lost." confirmLabel="Discard changes" />
  </UnsavedChangesContext.Provider>
}
