import { Router } from 'express'
import { getSupabaseClient } from '../config/supabase.js'
import { bookingRouter } from './booking.routes.js'
import { inventoryRouter } from './inventory.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

apiRouter.get('/health/db', async (_req, res) => {
  try {
    const { error } = await getSupabaseClient().auth.getSession()
    if (error) throw error
    res.json({ status: 'ok' })
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Supabase connection failed',
    })
  }
})

apiRouter.use('/bookings', bookingRouter)
apiRouter.use('/inventory', inventoryRouter)
