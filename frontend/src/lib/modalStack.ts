/** Suspend parent dialogs without unmounting their forms or losing edits. */
export function createModalStack() {
  const dialogs: HTMLDialogElement[] = []

  function sync() {
    const active = dialogs.at(-1)
    // Close the previous dialog before showing its replacement in the top layer.
    for (const dialog of dialogs) {
      if (dialog !== active && dialog.open) dialog.close()
    }
    if (active && !active.open) active.showModal()
  }

  return {
    add(dialog: HTMLDialogElement) {
      dialogs.push(dialog)
      sync()
      return () => {
        const index = dialogs.indexOf(dialog)
        if (index !== -1) dialogs.splice(index, 1)
        if (dialog.open) dialog.close()
        sync()
      }
    },
  }
}
