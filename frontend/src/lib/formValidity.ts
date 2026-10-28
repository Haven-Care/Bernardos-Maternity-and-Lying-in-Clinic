/** Shared by real forms and modal footer actions, which have no native submit. */
export function validateControls(scope: ParentNode): boolean {
  const controls = scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
  const invalid = [...controls].find((control) => control.willValidate && !control.checkValidity())
  if (!invalid) return true
  invalid.reportValidity()
  invalid.focus()
  return false
}
