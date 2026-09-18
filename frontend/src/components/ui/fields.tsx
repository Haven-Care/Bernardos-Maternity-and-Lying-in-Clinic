import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

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

function Error({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger-700">{message}</p>
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
}) {
  const id = useId()

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
      />
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      <Error message={error} />
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  placeholder,
  required,
  error,
  suffix,
}: {
  label: string
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  placeholder?: string
  required?: boolean
  error?: string
  suffix?: string
}) {
  const id = useId()

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          // Empty string rather than 0 when cleared — otherwise the field
          // fights the user by snapping back to 0 mid-edit.
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : Number(e.target.value))
          }
          className={`${CONTROL} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      <Error message={error} />
    </div>
  )
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

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
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
      <Error message={error} />
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
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  required?: boolean
  error?: string
}) {
  const id = useId()

  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} resize-y`}
      />
      <Error message={error} />
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
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} pl-9`}
      />
    </div>
  )
}
