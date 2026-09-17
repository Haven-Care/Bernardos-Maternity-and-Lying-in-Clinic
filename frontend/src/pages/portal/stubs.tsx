import { Placeholder } from './Placeholder'


export function Inventory() {
  return (
    <Placeholder
      title="Medicine Inventory"
      description="Track stock levels, expiry dates, and supply alerts"
      phase="Phase 4"
      screens={[
        'Medicine List — generic name, dosage form, qty on hand, status',
        'Stock Movement — the audit log of every stock in and out',
        'Low Stock — qty on hand against each medicine’s reorder level',
        'Expiration Tracker — batch no, expiration date, days left',
        'Medicine detail modal, Record Stock In / Stock Out',
      ]}
    />
  )
}

export function PatientRecords() {
  return (
    <Placeholder
      title="Patient Records"
      description="View and manage patient profiles"
      phase="Phase 5"
      screens={[
        'Records table — patient ID, name, contact number, last visit',
        'Personal Information section',
        'Maternity & Medical Info section',
        'Required Documents — uploads to a private bucket',
      ]}
    />
  )
}

export function Administration() {
  return (
    <Placeholder
      title="Administration"
      description="Manage account, services, and clinic settings"
      phase="Phase 5"
      screens={[
        'My Account — profile, security, notification preferences',
        'Services & Pricing — name, category, price, status',
        'Appointment Slots — per weekday, with capacity',
        'Clinic Info — general information and operating hours',
      ]}
    />
  )
}
