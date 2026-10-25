import { createContext, useCallback, useContext, useEffect, useId } from 'react'

export const UnsavedChangesContext = createContext({
  register: (_id: string, _dirty: boolean) => { void _id; void _dirty },
  confirmLeave: (): boolean => true,
  cancelLeave: () => {},
})
export function useConfirmLeave() { return useContext(UnsavedChangesContext) }

export function useUnsavedChanges(dirty: boolean) {
  const { register } = useContext(UnsavedChangesContext)
  const id = useId()
  useEffect(() => {
    register(id, dirty)
    return () => register(id, false)
  }, [register, id, dirty])

  return useCallback(() => !dirty || window.confirm('Discard your unsaved changes?'), [dirty])
}
