export interface Booking {
  id: string
  patientName: string
  service: string
  startsAt: string
  status: 'pending' | 'confirmed' | 'cancelled'
}
