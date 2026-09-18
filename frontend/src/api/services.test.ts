import { describe, expect, it } from 'vitest'
import * as servicesApi from './services'

/**
 * Deactivating a service is the admin's lever for taking something off the
 * public booking form without deleting its history. The two listings must
 * therefore disagree — `listServices` is the admin view, `listActiveServices`
 * is what a patient can pick from.
 */
describe('service visibility', () => {
  it('hides inactive services from the public booking form but keeps them in admin', async () => {
    const all = await servicesApi.listServices()
    const target = all.find((s) => s.name === 'Ultrasound')!

    await servicesApi.setServiceActive(target.id, false)

    const adminView = await servicesApi.listServices()
    const publicView = await servicesApi.listActiveServices()

    expect(adminView.map((s) => s.name)).toContain('Ultrasound')
    expect(publicView.map((s) => s.name)).not.toContain('Ultrasound')

    await servicesApi.setServiceActive(target.id, true)

    expect((await servicesApi.listActiveServices()).map((s) => s.name)).toContain(
      'Ultrasound',
    )
  })
})
