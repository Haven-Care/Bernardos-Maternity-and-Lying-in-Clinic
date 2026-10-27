import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`min-w-0 rounded-card border border-border bg-surface ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {action}
    </header>
  )
}
