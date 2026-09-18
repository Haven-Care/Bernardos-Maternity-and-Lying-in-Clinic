import { useSearchParams } from 'react-router-dom'
import type { Tab } from '../components/ui/Tabs'

/**
 * The tab currently selected in the query string.
 *
 * Lives outside `Tabs.tsx` because exporting a hook beside a component breaks
 * React Fast Refresh for that module.
 */
export function useActiveTab(tabs: Tab[], param = 'tab'): string {
  const [searchParams] = useSearchParams()
  const requested = searchParams.get(param)

  // Fall back to the first tab when the query string names one that no longer
  // exists, rather than rendering an empty panel.
  return tabs.some((t) => t.id === requested) ? requested! : tabs[0].id
}
