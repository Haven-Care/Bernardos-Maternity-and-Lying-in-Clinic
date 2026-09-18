import type { Service } from '../../types/service'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AsyncBoundary, EmptyState } from '../../components/ui/states'
import { formatPeso } from '../../lib/format'

/**
 * Step 1 — pick a service.
 *
 * Only active services are offered. Deactivating Ultrasound in Administration →
 * Services & Pricing removes it here on the next load, which is the behaviour
 * that screen's toggle promises.
 *
 * Prices are shown because the clinic already publishes them in the portal and a
 * patient asking "how much" by phone is the call this form exists to avoid.
 */
export function ServiceStep({
  value,
  onPick,
}: {
  value: string
  onPick: (service: Service) => void
}) {
  const services = useAsync(() => api.services.listActiveServices())

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">
        What do you need an appointment for?
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Choose one. You can change this later without starting over.
      </p>

      <div className="mt-4">
        <AsyncBoundary
          state={services}
          empty={
            <EmptyState
              title="No services available"
              description="The clinic isn’t accepting online bookings right now. Please call instead."
            />
          }
        >
          {(rows) => (
            <ul className="space-y-2">
              {rows.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => onPick(service)}
                    aria-pressed={value === service.id}
                    className={`flex w-full items-center gap-3 rounded-card border p-4 text-left transition-colors ${
                      value === service.id
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                        : 'border-border bg-surface hover:border-brand-300 hover:bg-brand-50/40'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">
                        {service.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {service.category}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-brand-700">
                      {formatPeso(service.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </div>
    </div>
  )
}
