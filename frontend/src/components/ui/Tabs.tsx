import { useSearchParams } from 'react-router-dom'

export interface Tab {
  id: string
  label: string
  /**
   * A count worth acting on, shown as a pill beside the label.
   *
   * Zero and undefined both render nothing — a badge reading "0" is a
   * notification that there is nothing to notify about.
   */
  badge?: number
}

/**
 * The underline tab strip used by Appointment, Inventory, and Administration.
 *
 * State lives in the query string (`?tab=low-stock`) rather than component
 * state, so the Dashboard's Urgent Alerts can deep-link straight to a tab and
 * the browser back button works between them.
 */
export function Tabs({
  tabs,
  param = 'tab',
}: {
  tabs: Tab[]
  param?: string
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = searchParams.get(param) ?? tabs[0]?.id

  return (
    <div
      role="tablist"
      className="flex gap-5 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.set(param, tab.id)
              // replace: tab switching shouldn't stack history entries, but the
              // back button should still leave the page.
              setSearchParams(next, { replace: true })
            }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              selected
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-xs leading-4 font-semibold text-white tabular-nums">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
