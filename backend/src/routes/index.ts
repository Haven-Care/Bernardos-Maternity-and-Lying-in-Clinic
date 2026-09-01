import { Router } from 'express'
import { bookingRouter } from './booking.routes.js'
import { inventoryRouter } from './inventory.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

apiRouter.use('/bookings', bookingRouter)
apiRouter.use('/inventory', inventoryRouter)
