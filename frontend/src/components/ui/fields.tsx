import { useId, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { calendarInputError, MAX_INTEGER, MAX_MONEY, numericSyntax, numberInputError, textInputError, type TextRule } from '../../lib/inputValidation'

const CONTROL =
  'w-full min-w-0 max-w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-gray-700"
    >
      {children}
      {required && <span className="ml-0.5 text-danger-500">*</span>}
    </label>
  )
}

function Error({ message, id }: { message?: string; id?: string }) {
  if (!message) return null
  return <p id={id} role="alert" className="mt-1 text-xs text-danger-700">{message}</p>
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  disabled,
  error,
  autoComplete,
  hint,
  validation, minLength = 0, maxLength, min, max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  autoComplete?: string
  hint?: string
  validation?: TextRule
  minLength?: number
  maxLength?: number
  min?: string
  max?: string
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const limit = maxLength ?? (type === 'email' ? 254 : 200)
  const dateType = ['date', 'datetime-local', 'time'].includes(type)
  const issue = textInputError(value, { label, required, minLength, maxLength: limit, rule: validation ?? (type === 'email' ? 'email' : type === 'tel' ? 'mobile' : 'text') }) ?? (dateType ? calendarInputError(value, type, min, max) : undefined)
  const shownError = error ?? (touched ? issue : undefined)

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <input
        ref={(element) => { element?.setCustomValidity(disabled ? '' : issue ?? '') }}
        id={id} type={type} value={value} required={required} maxLength={dateType ? undefined : limit} minLength={minLength || undefined} min={min ?? (type === 'date' ? '1900-01-01' : undefined)} max={max}
        placeholder={placeholder} disabled={disabled} autoComplete={autoComplete}
        aria-invalid={shownError ? true : undefined} aria-describedby={shownError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
        onInput={dateType ? (event) => onChange(event.currentTarget.value) : undefined}
        onChange={(event) => onChange(event.target.value)} className={CONTROL}
      />
      {hint && !shownError && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">{hint}</p>}
      <Error id={`${id}-error`} message={shownError} />
    </div>
  )
}

/**
 * A password input with a Show / Hide toggle.
 *
 * Patients type these on a phone, where a mistyped character behind the dots
 * is only discovered when the next screen refuses it.
 */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  autoComplete,
  minLength = 1, maxLength = 128,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  error?: string
  autoComplete?: string
  minLength?: number
  maxLength?: number
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const [touched, setTouched] = useState(false)
  const issue = (required && !value ? `${label} is required.` : value && value.length < minLength ? `Use at least ${minLength} characters.` : value.length > maxLength ? `Use at most ${maxLength} characters.` : undefined)
  const shownError = error ?? (touched ? issue : undefined)

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <input
          ref={(element) => { element?.setCustomValidity(issue ?? '') }}
          required={required} minLength={minLength} maxLength={maxLength}
          onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
          aria-describedby={shownError ? `${id}-error` : undefined}
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={shownError ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${CONTROL} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-gray-500 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 5.2a10.7 10.7 0 0 1 1.4-.1c5 0 8.7 4.2 10 6.9a12.8 12.8 0 0 1-3.1 4.1" />
                <path d="M6.4 6.4C4.3 7.8 2.8 9.8 2 12c1.3 2.7 5 6.9 10 6.9 1.3 0 2.5-.3 3.6-.8" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </>
            ) : (
              <>
                <path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      <Error id={`${id}-error`} message={shownError} />
    </div>
  )
}

/** Numeric input uses text semantics so browsers cannot accept e, signs, or letters. */
export function NumberField({ label, value, onChange, min = 0, max, decimalPlaces = 0, placeholder, required, error, suffix }: {
  label: string; value: number | ''; onChange: (value: number | '') => void
  min?: number; max?: number; decimalPlaces?: 0 | 2; placeholder?: string; required?: boolean; error?: string; suffix?: string
}) {
  const id = useId()
  const [edit, setEdit] = useState({ external: value, text: String(value) })
  const [rejected, setRejected] = useState<string>()
  const [touched, setTouched] = useState(false)
  const text = Object.is(edit.external, value) ? edit.text : String(value)
  const issue = rejected ?? numberInputError(text, { label, required, min, max: max ?? (decimalPlaces ? MAX_MONEY : MAX_INTEGER), decimalPlaces }) ?? error
  const shownError = rejected ?? error ?? (touched || (text !== '' && issue) ? issue : undefined)
  return <div>
    <Label htmlFor={id} required={required}>{label}</Label>
    <div className="relative">
      <input ref={(element) => { element?.setCustomValidity(issue ?? '') }} id={id} type="text" inputMode={decimalPlaces ? 'decimal' : 'numeric'}
        required={required} value={text} placeholder={placeholder} maxLength={decimalPlaces ? 12 : 10}
        aria-invalid={shownError ? true : undefined} aria-describedby={shownError ? `${id}-error` : undefined}
        onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
        onChange={(event) => {
          const raw = event.target.value
          if (!numericSyntax(raw, decimalPlaces)) {
            setRejected(decimalPlaces ? 'Enter a number with up to two decimal places.' : 'Enter a whole number.')
            return
          }
          setRejected(undefined)
          const next = raw === '' || raw === '.' ? '' : Number(raw)
          setEdit({ external: next, text: raw }); onChange(next)
        }}
        className={`${CONTROL} ${suffix ? 'pr-12' : ''}`} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">{suffix}</span>}
    </div>
    <Error id={`${id}-error`} message={shownError} />
  </div>
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  /**
   * `disabled` keeps an option visible but unselectable — better than omitting
   * it, because the user can see *why* a choice isn't available.
   */
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  required?: boolean
  error?: string
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  error,
  ...rest
}: SelectProps) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const issue = error ?? (required && !value ? `Choose ${label.toLowerCase()}.` : value && !options.some((option) => option.value === value && !option.disabled) ? 'Choose an available option.' : undefined)
  const shownError = error ?? (touched ? issue : undefined)

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        ref={(element) => { element?.setCustomValidity(rest.disabled ? '' : issue ?? '') }}
        onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
        required={required} aria-describedby={shownError ? `${id}-error` : undefined}
        id={id}
        value={value}
        aria-invalid={shownError ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Error id={`${id}-error`} message={shownError} />
    </div>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  required,
  error, minLength = 0, maxLength = 2000,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  minLength?: number
  maxLength?: number
  rows?: number
  placeholder?: string
  required?: boolean
  error?: string
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const issue = textInputError(value, { label, required, minLength, maxLength })
  const shownError = error ?? (touched ? issue : undefined)

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <textarea
        ref={(element) => { element?.setCustomValidity(issue ?? '') }}
        required={required} minLength={minLength || undefined} maxLength={maxLength}
        onBlur={() => setTouched(true)} onInvalid={() => setTouched(true)}
        aria-describedby={shownError ? `${id}-error` : undefined}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={shownError ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} resize-y`}
      />
      <Error id={`${id}-error`} message={shownError} />
    </div>
  )
}

/** Search input with a leading icon — every list screen has one. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        maxLength={200}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} min-w-0 max-w-full text-ellipsis pl-9`}
      />
    </div>
  )
}
