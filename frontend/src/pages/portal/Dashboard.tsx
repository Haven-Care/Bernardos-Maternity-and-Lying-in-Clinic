import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../../api'
import * as patientAccounts from '../../api/patientAccounts'
import { useAsync } from '../../hooks/useAsync'
import { AsyncBoundary, ErrorState } from '../../components/ui/states'
import { DASHBOARD_RANGES, type DashboardRange } from '../../types/dashboard'
import { DateRangeFields } from '../../components/ui/DateRangeFields'
import { dateRangeError } from '../../lib/dateRange'
import './Dashboard.css'

const PAGE_SIZE = 10
const LABELS = { good: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }
const RANGE_LABELS: Record<DashboardRange, string> = {
  today: 'Today', yesterday: 'Yesterday', 'last-7-days': 'Last 7 days',
  'this-month': 'This month', 'last-month': 'Last month', 'all-time': 'All time', custom: 'Custom dates',
}
export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRange = searchParams.get('range')
  const range: DashboardRange = requestedRange === 'custom' ? 'custom' : DASHBOARD_RANGES.find((value) => value === requestedRange) ?? 'today'
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const dates = { from, to }
  const ready = range !== 'custom' || (!!from && !!to && !dateRangeError(dates))
  const profile = useAsync(() => api.account.getProfile())
  const stats = useAsync(() => ready ? api.dashboard.getStats(range, { from, to }) : Promise.resolve(undefined), [range, from, to, ready])
  const accounts = useAsync(() => patientAccounts.list())
  const inventory = useAsync(() => api.inventory.listMedicines())
  const alerts = useAsync(() => api.dashboard.getUrgentAlerts())
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const rows = (inventory.data ?? []).filter(row => status === 'all' || row.stockStatus === status)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const start = (current - 1) * PAGE_SIZE
  const tiles = [
    { label: range === 'today' ? "Today's Schedule" : 'Scheduled', value: stats.data?.todaysSchedule },
    { label: range === 'today' ? 'Patient Bookings' : 'Bookings', value: stats.data?.bookedToday },
    { label: range === 'today' ? 'Completed Appointments' : 'Completed', value: stats.data?.completedAppointments },
    { label: 'Inventory Alerts', value: stats.data?.inventoryAlerts },
    { label: 'Patient Accounts', value: accounts.data?.length },
  ]
  return <div className="hc-dashboard">
    <header className="hc-dashboard-heading">
      <div>
        <h1>Dashboard</h1>
        <p>{profile.data?.fullName
          ? `Welcome back, ${profile.data.fullName.split(' ')[0]}. ${range === 'today' ? "Here's what's happening today." : 'Clinic overview.'}`
          : range === 'today' ? "Here's what's happening today." : 'Clinic overview.'}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3"><label className="hc-range">Date range
        <select value={range} onChange={(event) => {
          const next = new URLSearchParams(searchParams)
          next.set('range', event.target.value)
          if (event.target.value !== 'custom') { next.delete('from'); next.delete('to') }
          setSearchParams(next, { replace: true })
        }}>
          {[...DASHBOARD_RANGES, 'custom' as const].map((value) => <option key={value} value={value}>{RANGE_LABELS[value]}</option>)}
        </select>
      </label>
      {range === 'custom' && <DateRangeFields value={dates} required onChange={(value) => {
        const next = new URLSearchParams(searchParams)
        next.set('from', value.from); next.set('to', value.to)
        setSearchParams(next, { replace: true })
      }} />}
      </div>
    </header>
    <section className="hc-stats" aria-label="Clinic overview">
      {!ready ? <p className="text-sm text-gray-600">Choose start and end dates to view the overview.</p> : stats.error ? <div className="hc-stats-error"><ErrorState error={stats.error} onRetry={stats.reload} /></div> :
        tiles.map(tile => <article className="hc-stat" key={tile.label}>
          <h2>{tile.label}</h2><strong>{tile.value === undefined ? '...' : tile.value ?? '—'}</strong>
          {tile.value === null && <small>Not available</small>}
        </article>)}
    </section>
    <div className="hc-dashboard-body">
      <section className="hc-inventory" aria-labelledby="inventory-summary">
        <header><h2 id="inventory-summary">Inventory Summary &amp; Stock Monitoring</h2><Link to="/admin/inventory">View Full Inventory</Link></header>
        <div className="hc-filter">
          <label className="sr-only" htmlFor="stock-filter">Filter by stock status</label>
          <select id="stock-filter" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
            <option value="all">All Status</option>
            <option value="good">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
          </select>
        </div>
        <div className="hc-table-frame">
          <AsyncBoundary state={inventory}>{() => <div className="hc-table-scroll" role="region" aria-label="Inventory summary" tabIndex={0}>
            <table><caption className="sr-only">Current medicine stock levels</caption>
              <thead><tr>{['Generic/Medicine Name', 'Dosage Form', 'Dosage', 'Category', 'Available Stock', 'Status'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{rows.slice(start, start + PAGE_SIZE).map(row => <tr key={row.id}>
                <td>{row.genericName}</td><td>{row.dosageForm}</td><td>{row.dosage}</td><td>{row.category}</td>
                <td>{row.qtyOnHand} {row.unit}</td><td><span className={'hc-badge hc-stock-' + row.stockStatus}>{LABELS[row.stockStatus]}</span></td>
              </tr>)}
              {!rows.length && <tr><td colSpan={6}>No medicines match this status.</td></tr>}</tbody>
            </table>
          </div>}</AsyncBoundary>
          {inventory.data && <footer>
            <span>Showing {rows.length ? start + 1 : 0} to {Math.min(start + PAGE_SIZE, rows.length)} of {rows.length} entries</span>
            {pages > 1 && <nav aria-label="Inventory summary pages">
              <button disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
              <span>{current} / {pages}</span>
              <button disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
            </nav>}
          </footer>}
        </div>
      </section>
      <section className="hc-alerts" aria-labelledby="urgent-alerts">
        <h2 id="urgent-alerts">Urgent Alerts</h2>
        <AsyncBoundary state={alerts} empty={<p className="hc-empty">Nothing needs attention.</p>}>
          {items => <ul>{items.map(alert => <li key={alert.id}>
            <Link to={alert.href} className={'hc-alert ' + (alert.kind === 'low_stock' || alert.kind === 'reorder_level' || alert.severity === 'critical' ? 'hc-alert-critical' : '')}>
              <p><strong>{alert.subject}</strong> {alert.message}</p><p className="hc-alert-detail">{alert.detail}</p>
            </Link>
          </li>)}</ul>}
        </AsyncBoundary>
      </section>
    </div>
  </div>
}
