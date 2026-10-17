import type { DosageForm } from '../../../types/medicine'

/** A dosage-form illustration until the clinic supplies product photographs. */
export function MedicineThumbnail({ name, form }: { name: string; form: DosageForm }) {
  return (
    <span title="Product photo not added yet" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-700">
      <svg role="img" aria-label={`${name}: ${form.toLowerCase()} image placeholder`} className="size-8" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {form === 'Tablet' && (
          <>
            <circle cx="24" cy="24" r="14" fill="white" />
            <path d="M14 24h20" />
          </>
        )}
        {form === 'Capsule' && (
          <>
            <rect x="11" y="17" width="26" height="14" rx="7" transform="rotate(-35 24 24)" fill="white" />
            <path d="M20 15l8 12" />
          </>
        )}
        {form === 'Syrup' && (
          <>
            <path d="M18 8h12v7H18zM16 15h16v25H16z" fill="white" />
            <path d="M19 23h10M19 28h10" />
          </>
        )}
        {form === 'Injection' && (
          <>
            <path d="M10 38 38 10M12 29l7 7M29 12l7 7M18 30l12-12M9 39l-3 3M36 12l5-5" />
          </>
        )}
        {form === 'Ointment' && (
          <>
            <path d="M15 13h18l3 25H12z" fill="white" />
            <path d="M17 8h14v5H17zM19 23h10M19 28h10" />
          </>
        )}
      </svg>
    </span>
  )
}
