import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useBeforeUnload, useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { RECOVERY_USER_KEY, supabase } from '../lib/supabase'
import { UnsavedChangesContext } from '../hooks/useUnsavedChanges'

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
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { approved.current = false }, [location.key])
  useEffect(() => {
    if (!['/', '/login', '/patient/login'].includes(location.pathname)) return
    let mounted = true
    void supabase.auth.getSession().then(() => {
      if (mounted && sessionStorage.getItem(RECOVERY_USER_KEY)) navigate('/auth/recovery', { replace: true })
    }).catch(() => { /* A failed session check does not establish recovery. */ })
    return () => { mounted = false }
  }, [location.pathname, navigate])
  const confirmLeave = useCallback(() => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return false
    approved.current = true
    return true
  }, [dirty])
  const cancelLeave = useCallback(() => { approved.current = false }, [])
  const blocker = useBlocker(() => dirty && !approved.current)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Discard your unsaved changes?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useBeforeUnload(useCallback((event) => {
    if (!dirty || approved.current) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))

  return <UnsavedChangesContext.Provider value={{ register, confirmLeave, cancelLeave }}><Outlet /></UnsavedChangesContext.Provider>
}
