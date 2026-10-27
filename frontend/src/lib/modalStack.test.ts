import { describe, expect, it, vi } from 'vitest'
import { createModalStack } from './modalStack'

describe('single visible dialog', () => {
  function fixture() {
    const dialogs: HTMLDialogElement[] = []
    function dialog() {
      const element = {
        open: false,
        showModal: vi.fn(() => {
          expect(dialogs.some((other) => other.open)).toBe(false)
          element.open = true
        }),
        close: vi.fn(() => { element.open = false }),
      } as unknown as HTMLDialogElement
      dialogs.push(element)
      return element
    }
    return { stack: createModalStack(), dialog, dialogs }
  }

  it('replaces booking details with an action dialog and restores details on cancel', () => {
    const { stack, dialog } = fixture()
    const details = dialog()
    const confirmation = dialog()
    const closeDetails = stack.add(details)
    const closeConfirmation = stack.add(confirmation)
    expect(details.open).toBe(false)
    expect(confirmation.open).toBe(true)
    closeConfirmation()
    expect(details.open).toBe(true)
    expect(confirmation.open).toBe(false)
    closeDetails()
    expect(details.open).toBe(false)
  })

  it('handles record, edit, and discard dialogs without displaying two at once', () => {
    const { stack, dialog, dialogs } = fixture()
    const cleanup = [stack.add(dialog()), stack.add(dialog()), stack.add(dialog())]
    expect(dialogs.map((element) => element.open)).toEqual([false, false, true])
    cleanup[2]()
    expect(dialogs.map((element) => element.open)).toEqual([false, true, false])
    cleanup[1]()
    expect(dialogs.map((element) => element.open)).toEqual([true, false, false])
    cleanup[0]()
    expect(dialogs.every((element) => !element.open)).toBe(true)
  })

  it('does not reopen a parent removed while its child is active', () => {
    const { stack, dialog, dialogs } = fixture()
    const closeParent = stack.add(dialog())
    const closeChild = stack.add(dialog())
    closeParent()
    expect(dialogs.map((element) => element.open)).toEqual([false, true])
    closeChild()
    expect(dialogs.every((element) => !element.open)).toBe(true)
  })

  it('supports effect cleanup and re-registration under StrictMode', () => {
    const { stack, dialog } = fixture()
    const element = dialog()
    stack.add(element)()
    const cleanup = stack.add(element)
    expect(element.open).toBe(true)
    cleanup()
    expect(element.open).toBe(false)
  })
})
