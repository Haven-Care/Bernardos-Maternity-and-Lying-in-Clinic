import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

export interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

/**
 * Split from `Toast.tsx` because exporting a hook beside a component breaks
 * React Fast Refresh for that module.
 */
export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>')
  }
  return context
}
