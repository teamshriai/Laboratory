import {
  BellRingIcon,
  BellIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
  SettingsIcon,
  MenuIcon,
  SearchIcon,
  MoonIcon,
  LayoutGridIcon,
  SunIcon,
  LanguagesIcon,
  XIcon,
} from 'lucide-react'
import { Fragment } from 'react'
import { Link, useMatches, useNavigate } from 'react-router'
import { DEPARTMENTS, LANGUAGES, type StaffRole } from '@/domain/types'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { LANGUAGE_NAMES, type TKey } from '@/i18n/core'
import { cn } from '@/lib/cn'
import { useCriticals, useReference } from '@/services/queries'
import { Avatar, Kbd } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip } from '@/components/ui/tooltip'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { useTheme } from '../theme/context'
import { usePreferences } from '../preferences/context'
import { DEPARTMENT_ICONS } from './nav-config'
import { NotificationPanel } from './notification-panel'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export interface Crumb {
  key: TKey<'nav'>
  to?: string
}

function Breadcrumbs() {
  const t = useT('nav')
  const th = useT('header')
  const matches = useMatches()
  const crumbs = matches.flatMap((m) => {
    const handle = m.handle as { crumb?: TKey<'nav'> } | undefined
    return handle?.crumb ? [{ key: handle.crumb, to: m.pathname }] : []
  })
  if (crumbs.length === 0) return null
  return (
    <nav
      aria-label={th('breadcrumb')}
      className="hidden min-w-0 items-center gap-1.5 text-sm md:flex"
    >
      {crumbs.map((c, i) => (
        <Fragment key={c.to}>
          {i > 0 ? (
            <ChevronRightIcon className="size-3 shrink-0 text-fg-subtle" />
          ) : null}
          {i < crumbs.length - 1 ? (
            <Link
              to={c.to}
              className="truncate py-1 text-fg-muted hover:text-fg"
            >
              {t(c.key)}
            </Link>
          ) : (
            <span aria-current="page" className="truncate font-medium text-fg">
              {t(c.key)}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

function CriticalPill() {
  const t = useT('header')
  const { data } = useCriticals({ status: 'pending' })
  const count = data?.counts.pending ?? 0
  if (count === 0) return null
  return (
    <Link
      to="/laboratory/critical-values?status=pending"
      aria-label={t('criticalPillLabel')}
      className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger px-3 text-sm font-semibold text-on-danger shadow-danger transition-opacity hover:opacity-90"
    >
      <BellRingIcon strokeWidth={2.2} className="size-4" aria-hidden />
      <span className="hidden sm:inline">{t('criticalPill', { count })}</span>
      <span className="sm:hidden">{count}</span>
    </Link>
  )
}

function DepartmentMenu() {
  const t = useT('header')
  const e = useEnum()
  const { department, setDepartment } = usePreferences()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors [&_svg]:size-4',
            department
              ? 'border-primary-200 bg-primary-50 text-accent-text dark:border-primary-100'
              : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:bg-surface-2 hover:text-fg',
          )}
          aria-label={t('departmentFilter')}
        >
          {department ? DEPARTMENT_ICONS[department] : <LayoutGridIcon />}
          <span className="hidden max-w-36 truncate 2xl:inline">
            {department ? e('department', department) : t('allDepartments')}
          </span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>{t('departmentFilter')}</MenuLabel>
        <p className="px-2.5 pb-2 text-xs text-fg-muted">
          {t('departmentFilterHint')}
        </p>
        <MenuRadioGroup
          value={department ?? 'all'}
          onValueChange={(v) =>
            setDepartment(v === 'all' ? null : (v as typeof department))
          }
        >
          <MenuRadioItem value="all" icon={<LayoutGridIcon />}>
            {t('allDepartments')}
          </MenuRadioItem>
          {DEPARTMENTS.map((d) => (
            <MenuRadioItem key={d} value={d} icon={DEPARTMENT_ICONS[d]}>
              {e('department', d)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

function LanguageMenu() {
  const t = useT('header')
  const { language, setLanguage } = useLanguage()
  return (
    <Menu>
      <Tooltip content={t('language')}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={t('language')}
            className="focus-ring inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <LanguagesIcon className="size-[18px]" />
            <span className="hidden xl:inline" lang={language}>
              {LANGUAGE_NAMES[language]}
            </span>
          </button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent className="w-52">
        <MenuLabel>{t('language')}</MenuLabel>
        <MenuRadioGroup
          value={language}
          onValueChange={(v) => setLanguage(v as typeof language)}
        >
          {LANGUAGES.map((l) => (
            <MenuRadioItem key={l} value={l}>
              <span lang={l}>{LANGUAGE_NAMES[l]}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/** The design system's two-state sun/moon switch; the three-way picker is in Settings. */
function ThemeSwitch() {
  const t = useT('header')
  const { setPreference, resolved } = useTheme()
  const isDark = resolved === 'dark'
  return (
    <Tooltip content={t('darkMode')}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={t('darkMode')}
        onClick={() => setPreference(isDark ? 'light' : 'dark')}
        className="focus-ring tap-target group relative inline-flex items-center rounded-full border border-border bg-surface-2 transition-colors hover:border-line-strong"
      >
        <span
          aria-hidden
          className="relative m-1 flex h-8 w-14 items-center rounded-full"
        >
          <span
            className={cn(
              'absolute z-10 flex size-6 items-center justify-center rounded-full bg-surface shadow-card transition-transform duration-200 ease-out',
              isDark ? 'translate-x-7' : 'translate-x-1',
            )}
          >
            {isDark ? (
              <MoonIcon
                size={13}
                strokeWidth={2.5}
                className="text-primary-500"
              />
            ) : (
              <SunIcon
                size={13}
                strokeWidth={2.5}
                className="text-warning-text"
              />
            )}
          </span>
          <SunIcon
            size={12}
            className={cn(
              'absolute left-1.5 text-fg-subtle transition-opacity',
              isDark ? 'opacity-40' : 'opacity-0',
            )}
          />
          <MoonIcon
            size={12}
            className={cn(
              'absolute right-1.5 text-fg-subtle transition-opacity',
              isDark ? 'opacity-0' : 'opacity-40',
            )}
          />
        </span>
      </button>
    </Tooltip>
  )
}

const ROLE_ORDER: StaffRole[] = [
  'pathologist',
  'microbiologist',
  'technician',
  'phlebotomist',
  'lab-manager',
  'receptionist',
]

function ProfileMenu() {
  const t = useT('header')
  const e = useEnum()
  const navigate = useNavigate()
  const { actorId, setActorId } = usePreferences()
  const { preference, setPreference } = useTheme()
  const { language, setLanguage } = useLanguage()
  const { data } = useReference()
  const actor = data?.staff.find((s) => s.id === actorId)
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="focus-ring flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          aria-label={t('actingAs')}
        >
          <Avatar name={actor?.name ?? t('staffIdentity')} size="sm" />
          <span className="hidden leading-tight xl:block">
            <span className="block max-w-40 truncate text-sm font-medium text-fg">
              {actor?.name ?? t('staffIdentity')}
            </span>
            <span className="block max-w-40 truncate text-xs text-fg-subtle">
              {actor ? e('staffRole', actor.role) : t('labIdentity')}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className="hidden size-[15px] text-fg-subtle sm:block"
          />
        </button>
      </MenuTrigger>
      <MenuContent className="w-72">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={actor?.name ?? t('staffIdentity')} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">
              {actor?.name ?? t('staffIdentity')}
            </p>
            <p className="truncate text-xs text-fg-muted">
              {actor ? e('staffRole', actor.role) : ''} · {t('labIdentity')}
            </p>
          </div>
        </div>
        <MenuSeparator />
        <MenuLabel>{t('actingAs')}</MenuLabel>
        <p className="px-2.5 pb-1.5 text-xs text-fg-muted">
          {t('actingAsHint')}
        </p>
        <div className="max-h-72 scrollbar-thin overflow-y-auto">
          <MenuRadioGroup value={actorId} onValueChange={setActorId}>
            {ROLE_ORDER.flatMap((role) =>
              (data?.staff ?? [])
                .filter((s) => s.role === role)
                .map((s) => (
                  <MenuRadioItem key={s.id} value={s.id}>
                    <span className="block truncate">{s.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {e('staffRole', s.role)}
                    </span>
                  </MenuRadioItem>
                )),
            )}
          </MenuRadioGroup>
        </div>
        <div className="sm:hidden">
          <MenuSeparator />
          <MenuLabel>{t('theme')}</MenuLabel>
          <MenuRadioGroup
            value={preference}
            onValueChange={(v) => setPreference(v as typeof preference)}
          >
            {(['light', 'dark', 'system'] as const).map((p) => (
              <MenuRadioItem key={p} value={p}>
                {e('theme', p)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuLabel>{t('language')}</MenuLabel>
          <MenuRadioGroup
            value={language}
            onValueChange={(v) => setLanguage(v as typeof language)}
          >
            {LANGUAGES.map((l) => (
              <MenuRadioItem key={l} value={l}>
                <span lang={l}>{LANGUAGE_NAMES[l]}</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </div>
        <MenuSeparator />
        <MenuItem
          icon={<SettingsIcon />}
          onSelect={() => void navigate('/laboratory/settings')}
        >
          {t('settings')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export function Header({
  onOpenSearch,
  onOpenNav,
}: {
  onOpenSearch: () => void
  onOpenNav: () => void
}) {
  const t = useT('header')
  const tn = useT('nav')
  const { department, setDepartment } = usePreferences()
  const e = useEnum()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center gap-1.5 px-3 min-[360px]:gap-2.5 sm:px-4 md:px-6">
        <IconButton
          className="md:hidden"
          label={tn('openMenu')}
          icon={<MenuIcon className="size-5" />}
          onClick={onOpenNav}
        />
        <div className="min-w-0 flex-1 lg:flex-none lg:basis-72 xl:basis-80">
          <Breadcrumbs />
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          className="focus-ring group hidden h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-left text-sm text-fg-subtle transition-colors hover:border-line-strong md:flex lg:max-w-xl"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="truncate">{t('searchPlaceholder')}</span>
          <span className="ml-auto hidden items-center gap-1 lg:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <div className="ml-auto flex min-w-0 items-center gap-0.5 min-[360px]:gap-1.5">
          <IconButton
            className="md:hidden"
            label={t('searchShort')}
            icon={<SearchIcon className="size-[18px]" />}
            onClick={onOpenSearch}
          />
          <CriticalPill />
          <ErrorBoundary fallback={() => null}>
            <NotificationPanel trigger={<BellIcon className="size-[18px]" />} />
          </ErrorBoundary>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <div className="hidden items-center gap-1.5 sm:flex">
            <DepartmentMenu />
            <LanguageMenu />
            <ThemeSwitch />
          </div>
          <ProfileMenu />
        </div>
      </div>
      {department ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-primary-50 px-4 py-2 text-xs text-accent-text md:px-6">
          <CheckIcon strokeWidth={2.5} className="size-3.5" />
          <span className="font-medium">
            {t('departmentActive', { department: e('department', department) })}
          </span>
          <button
            type="button"
            onClick={() => setDepartment(null)}
            className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-semibold hover:bg-primary-100"
          >
            <XIcon className="size-3" />
            {t('clearDepartment')}
          </button>
        </div>
      ) : null}
    </header>
  )
}
