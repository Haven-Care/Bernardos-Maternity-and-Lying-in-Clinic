import { createContext, useCallback, useContext, useEffect, useId } from 'react'

export const UnsavedChangesContext = createContext<(id: string, dirty: boolean) => void>(() => {})

export function useUnsavedChanges(dirty: boolean) {
  const register = useContext(UnsavedChangesContext)
  const id = useId()
  useEffect(() => {
    register(id, dirty)
    return () => register(id, false)
  }, [register, id, dirty])

  return useCallback(() => !dirty || window.confirm('Discard your unsaved changes?'), [dirty])
}
