import type { Service } from '../types/service'

export interface ServiceGroup {
  category: string
  services: Service[]
}

/** The heading for services saved without a category. */
export const UNCATEGORISED = 'Other'

/**
 * Services grouped by category, for the booking form's collapsible sections.
 *
 * Categories are free text with no sort column of their own, so they sort
 * alphabetically, with "Other" last because it is the catch-all. Services keep
 * the order they arrived in, which is by name from the API.
 *
 * Category is trimmed before grouping: "Newborn Care" and "Newborn Care " are
 * the same heading to a patient.
 */
export function groupServicesByCategory(services: Service[]): ServiceGroup[] {
  const groups = new Map<string, Service[]>()

  for (const service of services) {
    const category = service.category.trim() || UNCATEGORISED
    const group = groups.get(category)
    if (group) group.push(service)
    else groups.set(category, [service])
  }

  return [...groups]
    .map(([category, rows]) => ({ category, services: rows }))
    .sort((a, b) => {
      if (a.category === UNCATEGORISED) return 1
      if (b.category === UNCATEGORISED) return -1
      return a.category.localeCompare(b.category)
    })
}
