import { useId } from 'react'
import { dateRangeError, type DateRange } from '../../lib/dateRange'

export function DateRangeFields({ value, onChange, required = false }: { value: DateRange; onChange: (range: DateRange) => void; required?: boolean }) {
  const id = useId()
  const error = dateRangeError(value)
  return <fieldset className="min-w-0">
    <legend className="sr-only">Date range</legend>
    <div className="flex flex-wrap items-end gap-2">
      {(['from', 'to'] as const).map((key) => <label key={key} className="min-w-0 text-xs font-medium text-gray-700">
        {key === 'from' ? 'Start date' : 'End date'}
        <input type="date" required={required} value={value[key]} min={key === 'to' ? value.from || undefined : undefined} max={key === 'from' ? value.to || undefined : undefined}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          onInput={(event) => onChange({ ...value, [key]: event.currentTarget.value })}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          className="mt-1.5 block w-40 max-w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none" />
      </label>)}
      {(value.from || value.to) && <button type="button" onClick={() => onChange({ from: '', to: '' })} className="pb-2 text-xs font-medium text-brand-700 underline">Clear dates</button>}
    </div>
    {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger-700">{error}</p>}
  </fieldset>
}
