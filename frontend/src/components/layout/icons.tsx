/** Inline 24px stroke icons. No icon dependency for a handful of glyphs. */

type Props = { className?: string }

function Icon({ className = 'size-[18px]', d }: Props & { d: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const DashboardIcon = (p: Props) => (
  <Icon {...p} d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
)

export const CalendarIcon = (p: Props) => (
  <Icon
    {...p}
    d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
  />
)

export const InventoryIcon = (p: Props) => (
  <Icon
    {...p}
    d="M20 8H4m16 0-1.4 11a1 1 0 0 1-1 .9H6.4a1 1 0 0 1-1-.9L4 8m16 0-1.6-3.4a1 1 0 0 0-.9-.6H6.5a1 1 0 0 0-.9.6L4 8m6 4v4m4-4v4"
  />
)

export const PatientsIcon = (p: Props) => (
  <Icon
    {...p}
    d="M20 13V7a2 2 0 0 0-2-2h-5l-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6m4-3h6m-3-3v6"
  />
)

export const SettingsIcon = (p: Props) => (
  <Icon
    {...p}
    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
  />
)

export const BellIcon = (p: Props) => (
  <Icon
    {...p}
    d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
  />
)

export const LogoutIcon = (p: Props) => (
  <Icon
    {...p}
    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"
  />
)
