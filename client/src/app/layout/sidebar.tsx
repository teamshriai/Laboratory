import { SettingsIcon, PanelLeftIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { DEPARTMENTS } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query'
import { DEPARTMENT_TONES, NAV_TONES, type IconTone } from '@/lib/icon-tones'
import { IconTile } from '@/components/ui/icon-tile'
import { Logo } from '@/components/ui/logo'
import { useWorkQueue } from '@/services/queries'
import { usePreferences } from '../preferences/context'
import { Count } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import {
  DEPARTMENT_ICONS,
  INVENTORY_NAV,
  LAB_NAV,
  OPERATIONS_NAV,
  type NavItem,
} from './nav-config'

export function Brand({ collapsed }: { collapsed?: boolean }) {
  const t = useT('common')
  return (
    <div className="flex items-center gap-2.5">
      {/* Collapsed to the rail, the mark alone names the product. */}
      <Logo alt={collapsed ? t('appName') : ''} className="-m-1 size-10" />
      {!collapsed ? (
        <span className="min-w-0 leading-tight">
          <span className="block text-[15px] font-bold tracking-[0.06em] whitespace-nowrap text-fg uppercase">
            {t('appName')}
          </span>
          <span className="block text-xs font-medium text-fg-subtle">
            {t('moduleName')}
          </span>
        </span>
      ) : null}
    </div>
  )
}

function useStageCounts() {
  const { department } = usePreferences()
  const { data } = useWorkQueue(department ?? undefined)
  return (stages?: NavItem['badge']) =>
    stages
      ? stages.reduce(
          (n, s) => n + (data?.stages.find((x) => x.stage === s)?.count ?? 0),
          0,
        )
      : 0
}

function NavEntry({
  to,
  label,
  icon,
  tone,
  collapsed,
  count,
  countTone,
  end,
  onNavigate,
}: {
  to: string
  label: string
  icon: ReactNode
  tone: IconTone
  collapsed?: boolean
  count?: number
  countTone?: 'danger' | 'accent' | 'neutral'
  end?: boolean
  onNavigate?: () => void
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-label={
        collapsed ? (count ? `${label} (${count})` : label) : undefined
      }
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex min-h-11 items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-0' : 'px-2',
          isActive
            ? 'bg-primary-50 text-accent-text'
            : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {() => (
        <>
          <IconTile icon={icon} tone={tone} size="sm" variant="solid" />
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate">{label}</span>
          ) : null}

          {count ? (
            collapsed ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-1 right-1.5 size-2.5 rounded-full border-2 border-surface',
                  countTone === 'danger' ? 'bg-danger' : 'bg-accent',
                )}
              />
            ) : (
              <Count
                value={count}
                tone={
                  countTone === 'danger'
                    ? 'danger'
                    : countTone === 'accent'
                      ? 'accent'
                      : 'neutral'
                }
              />
            )
          ) : null}
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={count ? `${label} (${count})` : label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

function Section({
  title,
  collapsed,
  children,
}: {
  title: string
  collapsed?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="grid gap-0.5">
      {collapsed ? (
        <>
          <span id={id} className="sr-only">
            {title}
          </span>
          <span aria-hidden className="mx-auto my-2.5 h-px w-6 bg-line" />
        </>
      ) : (
        <p
          id={id}
          className="px-2 pt-5 pb-2 text-xs font-semibold tracking-wider text-fg-subtle uppercase"
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const t = useT('nav')
  const e = useEnum()
  const count = useStageCounts()
  const render = (items: NavItem[]) =>
    items.map((item) => (
      <NavEntry
        key={item.key}
        to={item.to}
        end={item.end}
        label={t(item.key)}
        icon={item.icon}
        tone={NAV_TONES[item.key]}
        collapsed={collapsed}
        count={count(item.badge)}
        countTone={item.badgeTone}
        onNavigate={onNavigate}
      />
    ))
  return (
    <nav aria-label={t('mainNavigation')} className="grid gap-1">
      <Section title={t('sectionLaboratory')} collapsed={collapsed}>
        {render(LAB_NAV)}
      </Section>
      <Section title={t('sectionDepartments')} collapsed={collapsed}>
        {DEPARTMENTS.map((d) => (
          <NavEntry
            key={d}
            to={`/laboratory/departments/${d}`}
            label={e('department', d)}
            icon={DEPARTMENT_ICONS[d]}
            tone={DEPARTMENT_TONES[d]}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </Section>
      <Section title={t('sectionInventory')} collapsed={collapsed}>
        {render(INVENTORY_NAV)}
      </Section>
      <Section title={t('sectionOperations')} collapsed={collapsed}>
        {render(OPERATIONS_NAV)}
      </Section>
    </nav>
  )
}

export function SettingsEntry({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT('nav')
  return (
    <NavEntry
      to="/laboratory/settings"
      label={t('settings')}
      icon={<SettingsIcon />}
      tone={NAV_TONES.settings}
      {...(onNavigate ? { onNavigate } : {})}
    />
  )
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences()
  const desktop = useMediaQuery(DESKTOP_QUERY)
  // Tablets always get the icon rail; the preference applies on desktop.
  const collapsed = !desktop || sidebarCollapsed
  const t = useT('nav')
  const toggle = (
    <Tooltip content={collapsed ? t('expand') : t('collapse')} side="right">
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={collapsed ? t('expand') : t('collapse')}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar"
        aria-keyshortcuts="["
        className="focus-ring tap-reach hidden size-9 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:grid"
      >
        <PanelLeftIcon className="size-[18px]" aria-hidden />
      </button>
    </Tooltip>
  )
  return (
    <aside
      id="app-sidebar"
      aria-label={t('mainNavigation')}
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-line',
          collapsed
            ? 'h-auto flex-col gap-2 py-3'
            : 'h-16 justify-between px-4',
        )}
      >
        <NavLink
          to="/laboratory"
          aria-label={t('overview')}
          className="focus-ring rounded-lg"
        >
          <Brand collapsed={collapsed} />
        </NavLink>
        {toggle}
      </div>
      <div
        className={cn(
          'min-h-0 flex-1 scrollbar-thin overflow-y-auto pb-4',
          collapsed ? 'px-3' : 'px-3',
        )}
      >
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <NavEntry
          to="/laboratory/settings"
          label={t('settings')}
          icon={<SettingsIcon />}
          tone={NAV_TONES.settings}
          collapsed={collapsed}
        />
      </div>
    </aside>
  )
}
