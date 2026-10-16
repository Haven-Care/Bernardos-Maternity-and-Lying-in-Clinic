import { Tabs, type Tab } from '../../../components/ui/Tabs'
import { useActiveTab } from '../../../hooks/useActiveTab'
import { BookingRequests } from './BookingRequests'
import { CalendarWeek } from './CalendarWeek'
import './Appointments.css'

const TABS: Tab[] = [
  { id: 'requests', label: 'Appointments' },
  { id: 'calendar', label: 'Calendar' },
]

export function Appointments() {
  const active = useActiveTab(TABS)

  return (
    <div className={`appointments-page flex w-full min-w-0 flex-col gap-4 ${active === 'requests' ? 'appointments-page--list' : ''}`}>
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
