// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { NumberField, PasswordField, TextField } from './fields'
import { ValidatedForm } from './ValidatedForm'
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function type(input: HTMLInputElement, value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function click(button: HTMLButtonElement) { await act(() => button.click()) }

describe('quantity field and modal save', () => {
  it('rejects typed or pasted letters without committing the previous valid quantity', async () => {
    const save = vi.fn()
    function Disposal() {
      const [quantity, setQuantity] = useState<number | ''>(5)
      return <dialog open><NumberField label="Quantity Disposed" required min={1} max={10} value={quantity} onChange={setQuantity} /><footer data-validation-footer><Button onClick={() => save(quantity)}>Record Disposal</Button></footer></dialog>
    }
    await act(() => root.render(<Disposal />))
    const input = container.querySelector('input')!
    expect(input.type).toBe('text'); expect(input.inputMode).toBe('numeric')
    await type(input, 'aaa')
    expect(input.value).toBe('5')
    expect(container.textContent).toContain('Use digits only')
    await click(container.querySelector('button')!)
    expect(save).not.toHaveBeenCalled()
    await type(input, '4')
    await click(container.querySelector('button')!)
    expect(save).toHaveBeenCalledWith(4)
  })
  it('blocks quantities over the remaining batch balance', async () => {
    const save = vi.fn()
    function Disposal() {
      const [quantity, setQuantity] = useState<number | ''>('')
      return <dialog open><NumberField label="Quantity Disposed" required min={1} max={10} value={quantity} onChange={setQuantity} /><footer data-validation-footer><Button onClick={save}>Save</Button></footer></dialog>
    }
    await act(() => root.render(<Disposal />))
    await type(container.querySelector('input')!, '11')
    await click(container.querySelector('button')!)
    expect(save).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Enter no more than 10')
  })
  it('preserves decimal editing and rejects a third fractional digit', async () => {
    const save = vi.fn()
    function Pricing() {
      const [price, setPrice] = useState<number | ''>('')
      return <dialog open><NumberField label="Price" decimalPlaces={2} value={price} onChange={setPrice} /><footer data-validation-footer><Button onClick={() => save(price)}>Save</Button></footer></dialog>
    }
    await act(() => root.render(<Pricing />))
    const input = container.querySelector('input')!
    await type(input, '1.'); expect(input.value).toBe('1.')
    await type(input, '1.50'); expect(input.value).toBe('1.50')
    await type(input, '1.501'); expect(input.value).toBe('1.50')
    await click(container.querySelector('button')!); expect(save).not.toHaveBeenCalled()
    await type(input, '0.75'); await click(container.querySelector('button')!)
    expect(save).toHaveBeenCalledWith(0.75)
  })
})
describe('form validation', () => {
  it('blocks keyboard/programmatic submits and shows an associated field error', async () => {
    const submit = vi.fn()
    await act(() => root.render(<ValidatedForm onSubmit={(event) => { event.preventDefault(); submit() }}><TextField label="Email" required type="email" value="bad@" onChange={() => {}} /><Button type="submit">Save</Button></ValidatedForm>))
    await act(() => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(submit).not.toHaveBeenCalled()
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain('valid email')
  })
  it('allows a corrected password after a previous server/form mismatch message', async () => {
    const submit = vi.fn()
    await act(() => root.render(<ValidatedForm onSubmit={(event) => { event.preventDefault(); submit() }}><PasswordField label="Password" required value="Correct1!" onChange={() => {}} error="Old mismatch message" /><Button type="submit">Save</Button></ValidatedForm>))
    await click(container.querySelector('button[type="submit"]')!)
    expect(submit).toHaveBeenCalledOnce()
  })
})
