import { Router } from 'express'
import { requireStaff } from '../middleware/auth.js'
import {
  createDocument,
  createPatient,
  createUploadUrl,
  getDocumentUrl,
  getPatient,
  listDocuments,
  listPatients,
  updatePatient,
} from '../controllers/patients.controller.js'

/**
 * Patient records and their documents.
 *
 * Staff only, without exception — there is no public or patient-facing route
 * here. A patient reading their own clinical record is not a screen the design
 * has, and gravida, allergies and attending physician are not things to expose
 * on a guess about what a patient app might one day want.
 */
export const patientsRouter = Router()

patientsRouter.use(requireStaff)

patientsRouter.get('/', listPatients)
patientsRouter.post('/', createPatient)
patientsRouter.get('/:id', getPatient)
patientsRouter.patch('/:id', updatePatient)

patientsRouter.get('/:id/documents', listDocuments)
patientsRouter.post('/:id/documents/upload-url', createUploadUrl)
patientsRouter.post('/:id/documents', createDocument)

/**
 * Mounted at the top level because the contract asks for
 * `/documents/:id/url` — a document id is unique on its own, and the frontend
 * holds one without necessarily holding the patient it belongs to.
 */
export const documentsRouter = Router()

documentsRouter.use(requireStaff)
documentsRouter.get('/:id/url', getDocumentUrl)
