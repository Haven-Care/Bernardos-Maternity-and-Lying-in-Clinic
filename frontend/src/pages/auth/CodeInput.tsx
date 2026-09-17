import { useRef } from 'react'

const LENGTH = 6

/**
 * Six single-character boxes, per the Enter Verification Code screen.
 *
 * Value is held as one string by the parent; the boxes are a presentation of
 * it. That keeps paste, backspace-across-boxes, and arrow navigation from each
 * needing their own slice of state.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
}: {
  value: string
  onChange: (next: string) => void
  onComplete?: (code: string) => void
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  function commit(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH)
    onChange(digits)
    if (digits.length === LENGTH) onComplete?.(digits)
    return digits
  }

  function focus(index: number) {
    refs.current[Math.min(Math.max(index, 0), LENGTH - 1)]?.focus()
  }

  function handleInput(index: number, raw: string) {
    // A paste into one box carries the whole code, so take everything and
    // spread it across the boxes rather than truncating to one character.
    if (raw.length > 1) {
      const digits = commit(value.slice(0, index) + raw)
      focus(digits.length)
      return
    }

    const digit = raw.replace(/\D/g, '')
    if (!digit) return

    const chars = value.padEnd(LENGTH, ' ').split('')
    chars[index] = digit
    commit(chars.join('').trimEnd())
    focus(index + 1)
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) {
        // Clear this box first; a second backspace then steps back.
        const chars = value.split('')
        chars.splice(index, 1)
        onChange(chars.join(''))
      } else {
        const chars = value.split('')
        chars.splice(index - 1, 1)
        onChange(chars.join(''))
        focus(index - 1)
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focus(index - 1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focus(index + 1)
    }
  }

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          // One-time-code lets the OS offer an SMS/email code to autofill.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          value={value[index] ?? ''}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          className="size-11 rounded-md border border-gray-300 text-center text-lg font-semibold text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
        />
      ))}
    </div>
  )
}
