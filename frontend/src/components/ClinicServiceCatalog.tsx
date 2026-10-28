import { useState } from 'react'
import { clinicServices } from '../lib/clinicServices'
import { formatServicePrice, UNCATEGORISED } from '../lib/services'
import { useClinicServiceCatalog } from '../hooks/useActiveServices'
import { AsyncBoundary, EmptyState } from './ui/states'

const topServiceNames = new Set<string>(clinicServices.filter((service) => service.top).map((service) => service.name))

export function ClinicServiceCatalog() {
  const services = useClinicServiceCatalog()
  const [category, setCategory] = useState('Top services')
  const rows = services.data ?? []
  const categories = ['All', 'Top services', ...new Set(rows.map((service) => service.category.trim() || UNCATEGORISED))]
  const selectedCategory = categories.includes(category) ? category : 'All'
  const visible = rows.filter((service) =>
    selectedCategory === 'All' || (selectedCategory === 'Top services' ? topServiceNames.has(service.name) : (service.category.trim() || UNCATEGORISED) === selectedCategory),
  )

  return (
    <section aria-labelledby="clinic-services-heading" className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 id="clinic-services-heading" className="text-base font-semibold text-gray-900">
        Clinic services
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Browse {rows.length} services and current clinic rates.
      </p>
      <div role="group" aria-label="Service categories" className="-mx-1 mt-4 flex gap-2 overflow-x-auto lg:flex-wrap px-1 pb-2">
        {categories.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selectedCategory === option}
            onClick={() => setCategory(option)}
            className={`min-h-11 shrink-0 rounded-full px-3 py-1.5 sm:min-h-9 text-xs font-semibold transition-colors ${selectedCategory === option ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
          >
            {option}
          </button>
        ))}
      </div>
      <AsyncBoundary state={services} empty={<EmptyState title="No services available" />}>
      {() => <ul aria-label={selectedCategory} className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((service) => (
          <li key={service.id} className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700">
            <p className="font-medium">{service.name}</p>
            <p className="mt-1 text-brand-700">{formatServicePrice(service.price)}</p>
            {!service.active && <p className="mt-1 text-xs text-gray-500">Currently unavailable</p>}
          </li>
        ))}
        {visible.length === 0 && <li className="text-sm text-gray-500">No services in this category. Choose All to browse available services.</li>}
      </ul>}
      </AsyncBoundary>
    </section>
  )
}
