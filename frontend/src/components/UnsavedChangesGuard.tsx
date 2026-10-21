import { useCallback, useEffect, useState } from 'react'
import { Outlet, useBeforeUnload, useBlocker } from 'react-router-dom'
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
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Discard your unsaved changes?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useBeforeUnload(useCallback((event) => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))

  return <UnsavedChangesContext.Provider value={register}><Outlet /></UnsavedChangesContext.Provider>
}
