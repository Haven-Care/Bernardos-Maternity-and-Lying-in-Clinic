// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Patient, PatientDocument } from '../../../types/patient'

const { getPatient, listDocuments, uploadDocument, updatePatient, onClose, onSaved } = vi.hoisted(() => ({
  getPatient: vi.fn(), listDocuments: vi.fn(), uploadDocument: vi.fn(), updatePatient: vi.fn(), onClose: vi.fn(), onSaved: vi.fn(),
}))
vi.mock('../../../api', () => ({ patients: { getPatient, listDocuments, uploadDocument, updatePatient } }))
vi.mock('../../../components/ui/toast-context', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
import { PatientModal } from './PatientModal'

const patient: Patient = {
  id: 'patient', patientCode: 'P-1', fullName: 'Test Patient', contactNumber: '09171234567', email: 'patient@example.test',
  dateOfBirth: null, sex: null, civilStatus: null, address: '', occupation: '', bloodType: null,
  emergencyContactName: '', emergencyContactNumber: '', emergencyContactRelation: '', lastMenstrualPeriod: null,
  expectedDeliveryDate: null, gravida: null, para: null, attendingPhysician: '', allergies: '', medicalConditions: '',
  visitType: null, lastVisit: null, createdAt: '2026-10-28T00:00:00Z',
}
let container: HTMLDivElement
let root: Root
let savedDocuments: PatientDocument[]
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  savedDocuments = []
  getPatient.mockResolvedValue(patient)
  listDocuments.mockImplementation(async () => [...savedDocuments])
  uploadDocument.mockImplementation(async (patientId, docType, file: File) => {
    const document = { id: `${docType}-id`, patientId, docType, fileName: file.name, fileSize: file.size, uploadedAt: '', uploadedBy: 'Staff' }
    savedDocuments.push(document)
    return document
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function render() { await act(async () => { root.render(<PatientModal open patientId="patient" onClose={onClose} onSaved={onSaved} />) }) }
function saveButton() { return [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Save Changes')! }
async function select(label: string, file = new File(['image'], 'document.png', { type: 'image/png' })) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="Upload ${label}"]`)!
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
  return file
}

describe('saving patient documents', () => {
  it('enables Save Changes for an image-only change and uploads only when saved', async () => {
    await render()
    expect(saveButton().disabled).toBe(true)
    const file = await select('Valid Government ID')
    expect(saveButton().disabled).toBe(false)
    expect(container.textContent).toContain('Not saved yet')
    expect(uploadDocument).not.toHaveBeenCalled()
    await act(async () => saveButton().click())
    expect(uploadDocument).toHaveBeenCalledExactlyOnceWith('patient', 'valid_id', file)
    expect(updatePatient).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('keeps failed documents selected so Save Changes can retry', async () => {
    uploadDocument.mockRejectedValueOnce(new Error('Upload unavailable'))
    await render()
    await select('Lab Results')
    await act(async () => saveButton().click())
    expect(container.textContent).toContain('Upload unavailable')
    expect(container.textContent).toContain('Not saved yet')
    expect(saveButton().disabled).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => saveButton().click())
    expect(uploadDocument).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('does not re-upload completed documents when a later document fails', async () => {
    await render()
    await select('Valid Government ID')
    await select('Lab Results')
    uploadDocument.mockImplementationOnce(async (_id, docType, file: File) => {
      savedDocuments.push({ id: 'id', patientId: 'patient', docType, fileName: file.name, fileSize: file.size, uploadedAt: '', uploadedBy: '' })
    }).mockRejectedValueOnce(new Error('Second upload failed'))
    await act(async () => saveButton().click())
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => saveButton().click())
    expect(uploadDocument.mock.calls.map((call) => call[1])).toEqual(['valid_id', 'lab_results', 'lab_results'])
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('confirms discarding a selected document before closing the record', async () => {
    await render()
    await select('Ultrasound Report')
    await act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click())
    expect(container.textContent).toContain('Discard unsaved changes?')
    expect(onClose).not.toHaveBeenCalled()
    expect(uploadDocument).not.toHaveBeenCalled()
    const discard = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Discard changes')!
    await act(() => discard.click())
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('allows a selected file to be removed without saving or uploading it', async () => {
    await render()
    await select('Valid Government ID')
    await act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Remove selected Valid Government ID"]')!.click())
    expect(saveButton().disabled).toBe(true)
    expect(uploadDocument).not.toHaveBeenCalled()
  })
  it('rejects unsupported files before making the record dirty', async () => {
    await render()
    await select('Valid Government ID', new File(['bad'], 'script.js', { type: 'text/javascript' }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Choose a JPG')
    expect(saveButton().disabled).toBe(true)
    expect(uploadDocument).not.toHaveBeenCalled()
  })
})
