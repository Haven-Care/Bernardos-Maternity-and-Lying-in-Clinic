import { useState } from 'react'
import { clinicServiceCategories, clinicServices } from '../lib/clinicServices'

type Category = typeof clinicServiceCategories[number]

export function ClinicServiceCatalog() {
  const [category, setCategory] = useState<Category>('Top services')
  const visible = clinicServices.filter((service) =>
    category === 'All' || (category === 'Top services' ? service.top : service.category === category),
  )

  return (
    <section aria-labelledby="clinic-services-heading" className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 id="clinic-services-heading" className="text-base font-semibold text-gray-900">
        Clinic services
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Browse all {clinicServices.length} services offered. Contact the clinic for prices and availability.
      </p>
      <div role="group" aria-label="Service categories" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
        {clinicServiceCategories.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${category === option ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
          >
            {option}
          </button>
        ))}
      </div>
      <ul aria-label={category} className="mt-2 grid gap-2 sm:grid-cols-2">
        {visible.map((service) => (
          <li key={service.name} className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700">
            {service.name}
          </li>
        ))}
      </ul>
    </section>
  )
}
