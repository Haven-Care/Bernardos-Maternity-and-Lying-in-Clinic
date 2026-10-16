import { mockDelay } from '../mocks/util'

export interface ClinicalRecord {
  id: string
  patientId: string
  occurredAt: string
  title: string
  findings: string
  provider: string
}
export type ClinicalRecordInput = Omit<ClinicalRecord, 'id' | 'patientId'>

// Demo records for the prototype; replace with patient-scoped backend endpoints.
const records: ClinicalRecord[] = [
  { id: 'history-1', patientId: 'pat-1', occurredAt: '2026-08-29T09:00', title: 'Prenatal Routine Check-Up', findings: 'Mild gestational hypertension. Bilateral +1 non-pitting ankle edema; dipstick negative for proteinuria.', provider: 'Dr. Rey Alonzo, MD (OB-GYN)' },
  { id: 'history-2', patientId: 'pat-1', occurredAt: '2026-07-15T13:30', title: '2nd Trimester Anomaly Scan (Ultrasound)', findings: 'Normal fetal morphology, cephalic presentation, adequate amniotic fluid index. Normal anatomy.', provider: 'Dr. Maria Santos, MD (Sonologist)' },
  { id: 'history-3', patientId: 'pat-1', occurredAt: '2026-05-10T10:15', title: 'Routine 16-Week Prenatal & Blood Chem Lab', findings: 'CBC & Urinalysis clear. Hemoglobin: 12.1 g/dL. Uncomplicated singleton progression.', provider: 'Dr. Rey Alonzo, MD (OB-GYN)' },
  { id: 'history-4', patientId: 'pat-1', occurredAt: '2026-03-02T09:30', title: 'First Consultation & Dating Ultrasound', findings: 'Intrauterine pregnancy confirmed at 6 weeks 2 days. Normal early cardiac activity observed.', provider: 'Dr. Maria Santos, MD (Sonologist)' },
]

export async function list(patientId: string): Promise<ClinicalRecord[]> {
  return mockDelay(records.filter((record) => record.patientId === patientId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((record) => ({ ...record })))
}

export async function create(patientId: string, input: ClinicalRecordInput): Promise<void> {
  if (!patientId || !input.title.trim() || !input.findings.trim() || !input.provider.trim() || !Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error('Complete the date, consultation, findings, and provider fields.')
  }
  records.push({ ...input, title: input.title.trim(), findings: input.findings.trim(), provider: input.provider.trim(), patientId, id: crypto.randomUUID() })
  return mockDelay(undefined)
}