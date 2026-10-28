import type { FormHTMLAttributes } from 'react'
import { validateControls } from '../../lib/formValidity'

export function ValidatedForm({ onSubmitCapture, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} noValidate onSubmitCapture={(event) => {
    // Capture covers Enter and requestSubmit(), even when no button is clicked.
    if (!validateControls(event.currentTarget)) { event.preventDefault(); event.stopPropagation(); return }
    onSubmitCapture?.(event)
  }} />
}
