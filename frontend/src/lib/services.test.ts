import { describe, expect, it } from 'vitest'
import type { Service } from '../types/service'
import { groupServicesByCategory } from './services'

function service(name: string, category: string): Service {
  return { id: name, name, category, price: 0, active: true }
}

describe('groupServicesByCategory', () => {
  it('sorts categories alphabetically and keeps service order inside each', () => {
    const groups = groupServicesByCategory([
      service('Pap Smear', 'OB-Gyne'),
      service('Implant', 'Family Planning'),
      service('OB-Gyne Check-up', 'OB-Gyne'),
      service('IUD', 'Family Planning'),
    ])

    expect(groups.map((g) => g.category)).toEqual(['Family Planning', 'OB-Gyne'])
    expect(groups[1].services.map((s) => s.name)).toEqual([
      'Pap Smear',
      'OB-Gyne Check-up',
    ])
  })

  it('puts blank categories under Other, and Other last', () => {
    const groups = groupServicesByCategory([
      service('Walk-in', ''),
      service('Anything else', 'Other'),
      service('Hearing Test', 'Newborn'),
      service('Untrimmed', '   '),
    ])

    expect(groups.map((g) => g.category)).toEqual(['Newborn', 'Other'])
    expect(groups[1].services).toHaveLength(3)
  })

  it('treats surrounding whitespace as the same category', () => {
    const groups = groupServicesByCategory([
      service('BCG', 'Immunization'),
      service('Hepa-B', 'Immunization '),
    ])

    expect(groups).toHaveLength(1)
  })

  it('returns nothing for no services', () => {
    expect(groupServicesByCategory([])).toEqual([])
  })
})
