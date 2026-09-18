import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { BookingRequests } from './BookingRequests'
import { CalendarWeek } from './CalendarWeek'

const TABS: Tab[] = [
  { id: 'requests', label: 'Booking Requests' },
  { id: 'calendar', label: 'Calendar' },
]

export function Appointments() {
  const active = useActiveTab(TABS)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Appointment Management
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          View and manage patient appointments
        </p>
      </div>

      <Tabs tabs={TABS} />

      {active === 'requests' ? <BookingRequests /> : <CalendarWeek />}
    </div>
  )
}
