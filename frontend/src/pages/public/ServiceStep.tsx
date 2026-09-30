import { useId, useMemo, useState } from 'react'
import type { Service } from '../../types/service'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { AsyncBoundary, EmptyState } from '../../components/ui/states'
import { formatPeso } from '../../lib/format'
import { groupServicesByCategory } from '../../lib/services'

/**
 * Step 1 — pick a service.
 *
 * Only active services are offered. Deactivating one in Administration →
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
          {(rows) => <ServiceGroups rows={rows} value={value} onPick={onPick} />}
        </AsyncBoundary>
      </div>
    </div>
  )
}

/**
 * One collapsible section per category, so a list of fifteen-odd services reads
 * as four or five choices on a phone.
 *
 * The first section starts open, and so does the one holding the current pick —
 * a patient who comes back to this step from a restored draft should see what
 * they chose rather than a wall of closed headings.
 */
function ServiceGroups({
  rows,
  value,
  onPick,
}: {
  rows: Service[]
  value: string
  onPick: (service: Service) => void
}) {
  const baseId = useId()
  const groups = useMemo(() => groupServicesByCategory(rows), [rows])

  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const initial = new Set<string>()
    if (groups[0]) initial.add(groups[0].category)
    const picked = groups.find((g) => g.services.some((s) => s.id === value))
    if (picked) initial.add(picked.category)
    return initial
  })

  function toggle(category: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => {
        const expanded = open.has(group.category)
        const panelId = `${baseId}-${index}`
        const count = group.services.length

        return (
          <section
            key={group.category}
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            <h2>
              <button
                type="button"
                onClick={() => toggle(group.category)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {group.category}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                  {count} {count === 1 ? 'service' : 'services'}
                  <Chevron className={expanded ? 'rotate-180' : ''} />
                </span>
              </button>
            </h2>

            {expanded && (
              <ul id={panelId} className="space-y-2 border-t border-border p-3">
                {group.services.map((service) => (
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
                      <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
                        {service.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand-700">
                        {formatPeso(service.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`size-4 transition-transform ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
