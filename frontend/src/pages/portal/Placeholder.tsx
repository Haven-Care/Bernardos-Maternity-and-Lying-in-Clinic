import { Card } from '../../components/ui/Card'

/**
 * Stand-in for a module that hasn't been built yet.
 *
 * Deliberately says which phase owns it rather than rendering a plausible-but-
 * fake screen — a blank page that admits it's blank is honest; a mock screen
 * that looks finished is not.
 */
export function Placeholder({
  title,
  description,
  phase,
  screens,
}: {
  title: string
  description: string
  phase: string
  screens: string[]
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>

      <Card className="p-8">
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
          {phase}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Not built yet. The data layer behind this screen is done and tested —
          only the UI is outstanding.
        </p>
        <ul className="mt-4 flex flex-col gap-1.5">
          {screens.map((screen) => (
            <li
              key={screen}
              className="flex items-center gap-2 text-sm text-gray-500"
            >
              <span className="size-1.5 rounded-full bg-gray-300" />
              {screen}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
