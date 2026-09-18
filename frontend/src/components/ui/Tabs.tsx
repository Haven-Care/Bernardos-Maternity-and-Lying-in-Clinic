import { useSearchParams } from 'react-router-dom'

export interface Tab {
  id: string
  label: string
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
            className={`-mb-px border-b-2 px-0.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              selected
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
