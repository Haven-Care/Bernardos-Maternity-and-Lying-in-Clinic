import { Router } from 'express'
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
} from '../controllers/inventory.controller.js'

export const inventoryRouter = Router()

inventoryRouter.get('/', listInventoryItems)
inventoryRouter.get('/:id', getInventoryItem)
inventoryRouter.post('/', createInventoryItem)
inventoryRouter.patch('/:id', updateInventoryItem)
inventoryRouter.delete('/:id', deleteInventoryItem)
