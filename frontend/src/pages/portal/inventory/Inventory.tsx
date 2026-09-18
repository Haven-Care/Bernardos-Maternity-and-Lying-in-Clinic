import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { Button } from '../../../components/ui/Button'
import { StatTile, StatTileSkeleton } from '../../../components/ui/StatTile'
import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { MedicineList } from './MedicineList'
import { StockMovements } from './StockMovements'
import { LowStock } from './LowStock'
import { ExpirationTracker } from './ExpirationTracker'
import { MedicineModal } from './MedicineModal'

/**
 * Tab ids are load-bearing — the Dashboard's Urgent Alerts link straight to
 * `?tab=low-stock` and `?tab=expiring`. Renaming one breaks those links
 * silently, since an unknown tab falls back to the first.
 */
const TABS: Tab[] = [
  { id: 'medicines', label: 'Medicine List' },
  { id: 'movements', label: 'Stock Movement' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'expiring', label: 'Expiring Soon' },
]

export function Inventory() {
  const active = useActiveTab(TABS)
  const [adding, setAdding] = useState(false)

  const stats = useAsync(() => api.inventory.getInventoryStats())
  // One version counter shared by every tab: a stock movement changes the
  // medicine list, the alerts, and the stat tiles at once, so they reload
  // together rather than each screen going stale in its own way.
  const [version, setVersion] = useState(0)

  function refresh() {
    stats.reload()
    setVersion((v) => v + 1)
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Medicine Inventory
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Track stock levels, expiry dates, and supply alerts
          </p>
        </div>

        <Button onClick={() => setAdding(true)}>+ Add New Medicine</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.data === undefined ? (
          <>
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </>
        ) : (
          <>
            <StatTile label="Total Medicines" value={stats.data.totalMedicines} />
            <StatTile
              label="Low Stock"
              value={stats.data.lowStock}
              tone={stats.data.lowStock > 0 ? 'warning' : 'default'}
            />
            <StatTile
              label="Expiring Soon"
              value={stats.data.expiringSoon}
              tone={stats.data.expiringSoon > 0 ? 'warning' : 'default'}
            />
            <StatTile
              label="Expired"
              value={stats.data.expired}
              tone={stats.data.expired > 0 ? 'danger' : 'default'}
            />
          </>
        )}
      </div>

      <Tabs tabs={TABS} />

      {active === 'medicines' && (
        <MedicineList version={version} onChanged={refresh} />
      )}
      {active === 'movements' && <StockMovements version={version} />}
      {active === 'low-stock' && <LowStock version={version} />}
      {active === 'expiring' && <ExpirationTracker version={version} />}

      {adding && (
        <MedicineModal
          open={adding}
          onClose={() => setAdding(false)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
