import {
  LayoutGridIcon,
  ListOrderedIcon,
  MenuIcon,
  ScanLineIcon,
  StethoscopeIcon,
  UsersIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { useVisibleNav } from './use-visible-nav'

const ITEM =
  'focus-ring flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-2xs font-medium text-fg-muted transition-colors [&_svg]:size-5'

function Item({
  to,
  end,
  icon,
  label,
}: {
  to: string
  end?: boolean
  icon: ReactNode
  label: string
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(ITEM, isActive ? 'text-accent-text' : 'hover:text-fg')
        }
      >
        {icon}
        <span className="max-w-full truncate">{label}</span>
      </NavLink>
    </li>
  )
}

/**
 * Phones (below 768px): the daily destinations a thumb's reach away, with
 * scanning in the middle. "More" opens the full navigation drawer.
 */
export function BottomNav({
  onOpenSearch,
  onOpenNav,
}: {
  onOpenSearch: () => void
  onOpenNav: () => void
}) {
  const t = useT('nav')
  const { doctorOnly } = useVisibleNav()
  const more = (
    <li>
      <button
        type="button"
        onClick={onOpenNav}
        aria-haspopup="dialog"
        className={cn(ITEM, 'w-full hover:text-fg')}
      >
        <MenuIcon aria-hidden />
        <span className="max-w-full truncate">{t('bottomMore')}</span>
      </button>
    </li>
  )
  if (doctorOnly)
    return (
      <nav
        aria-label={t('bottomNav')}
        className="bottom-nav fixed inset-x-0 bottom-0 z-[15] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-2 gap-1 px-2 py-1">
          <Item
            to="/my-patients"
            icon={<StethoscopeIcon />}
            label={t('myPatients')}
          />
          {more}
        </ul>
      </nav>
    )
  return (
    <nav
      aria-label={t('bottomNav')}
      className="bottom-nav fixed inset-x-0 bottom-0 z-[15] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-1">
        <Item
          to="/dashboard"
          end
          icon={<LayoutGridIcon />}
          label={t('bottomHome')}
        />
        <Item
          to="/work-queue"
          icon={<ListOrderedIcon />}
          label={t('bottomQueue')}
        />
        <li>
          <button
            type="button"
            onClick={onOpenSearch}
            className={cn(ITEM, 'w-full text-fg hover:text-accent-text')}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent [&_svg]:size-[18px]">
              <ScanLineIcon aria-hidden />
            </span>
            <span className="max-w-full truncate">{t('bottomScan')}</span>
          </button>
        </li>
        <Item to="/patients" icon={<UsersIcon />} label={t('bottomPatients')} />
        {more}
      </ul>
    </nav>
  )
}
