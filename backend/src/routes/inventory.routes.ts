import { Router } from 'express'
import { requireStaff } from '../middleware/auth.js'
import {
  createMedicine,
  getInventoryStats,
  getMedicine,
  listBatches,
  listExpiring,
  listLowStock,
  listMedicines,
  listMovements,
  recordStockIn,
  recordStockOut,
  updateMedicine,
} from '../controllers/inventory.controller.js'

/**
 * Inventory.
 *
 * Staff only, all of it. Stock levels, supplier names and unit costs are the
 * clinic's commercial information — the pitch's own line is that a patient
 * never sees the inventory or the supplier costs, and that is a boundary
 * between two products rather than a setting.
 */
export const inventoryRouter = Router()

inventoryRouter.use(requireStaff)

inventoryRouter.get('/medicines', listMedicines)
inventoryRouter.post('/medicines', createMedicine)
inventoryRouter.get('/medicines/:id', getMedicine)
inventoryRouter.patch('/medicines/:id', updateMedicine)
inventoryRouter.get('/medicines/:id/batches', listBatches)

inventoryRouter.get('/movements', listMovements)
inventoryRouter.get('/low-stock', listLowStock)
inventoryRouter.get('/expiring', listExpiring)
inventoryRouter.get('/stats', getInventoryStats)

// Writes, not reads: stock never changes by anything else.
inventoryRouter.post('/stock-in', recordStockIn)
inventoryRouter.post('/stock-out', recordStockOut)
