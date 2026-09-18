import type { Request, Response } from 'express'
import type { InventoryItem } from '../types/inventory.js'

export function listInventoryItems(_req: Request, res: Response) {
  const items: InventoryItem[] = []
  res.json(items)
}

export function getInventoryItem(req: Request, res: Response) {
  res.status(404).json({ error: `Inventory item not found: ${req.params.id}` })
}

export function createInventoryItem(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}

export function updateInventoryItem(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}

export function deleteInventoryItem(_req: Request, res: Response) {
  res.status(501).json({ error: 'Not implemented' })
}
