import { LucideProvider } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Outlet, useLocation } from 'react-router'
import { ModuleGate } from './module-gate'
import {
  DESKTOP_QUERY,
  RAIL_QUERY,
  useMediaQuery,
} from '@/hooks/use-media-query'
import { IconButton } from '@/components/ui/icon-button'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { useReturnFocus } from '@/components/ui/return-focus'
import { useReference } from '@/services/queries'
import { usePreferences } from '../preferences/context'
import { CommandPalette } from './command-palette'
import { DrawerHost } from './drawer-host'
import { Header } from './header'
import {
  Brand,
  CoBrandRow,
  SettingsEntry,
  Sidebar,
  SidebarNav,
} from './sidebar'
import { LabAssistant } from './assistant/lab-assistant'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { BottomNav } from './bottom-nav'
import { useRoleHome } from './use-role-home'
import { demo } from '@/services/lab-api'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(
    el &&
    (el.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)),
  )
}

/** The drawer footer: whose name actions are recorded under (not a sign-in). */
function ActingAs() {
  const th = useT('header')
  const { actorId } = usePreferences()
  const { data } = useReference()
  const actor = data?.staff.find((s) => s.id === actorId)
  if (!actor) return null
  return (
    <p className="truncate px-2 pt-2 text-xs text-fg-subtle">
      {th('actingAs')}: {actor.name}
    </p>
  )
}

function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT('nav')
  const tc = useT('common')
  const rail = useMediaQuery(RAIL_QUERY)
  // The drawer only exists on phones: close it when the rail takes over.
  useEffect(() => {
    if (rail && open) onOpenChange(false)
  }, [rail, open, onOpenChange])
  const close = () => onOpenChange(false)
  const focus = useReturnFocus(open)
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay md:hidden" />
        <D.Content
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onOpenAutoFocus={(e) => {
            // Start on the current page's link (else the first link), never
            // on the close button: its tooltip would take the first Escape.
            const panel = e.currentTarget as HTMLElement
            const start =
              panel.querySelector<HTMLElement>('[aria-current="page"]') ??
              panel.querySelector<HTMLElement>('nav a[href]')
            if (start) {
              e.preventDefault()
              start.focus()
            }
          }}
          className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] animate-drawer-left flex-col border-r border-line bg-surface shadow-card-lg outline-none md:hidden"
        >
          <D.Title className="sr-only">{t('mainNavigation')}</D.Title>
          <D.Description className="sr-only">
            {t('mainNavigation')}
          </D.Description>
          <div className="flex h-16 items-center justify-between gap-2.5 border-b border-line px-4">
            <Brand onNavigate={close} />
            <D.Close asChild>
              <IconButton
                label={tc('close')}
                icon={<XIcon className="size-5" />}
              />
            </D.Close>
          </div>
          <CoBrandRow />
          <div className="flex-1 scrollbar-thin overflow-y-auto px-3 pb-4">
            <SidebarNav onNavigate={close} />
          </div>
          <div className="shrink-0 border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SettingsEntry onNavigate={close} />
            {demo.enabled ? <ActingAs /> : null}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export function AppShell() {
  const t = useT('common')
  const { sidebarCollapsed, setSidebarCollapsed, density } = usePreferences()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const announcer = useRef<HTMLParagraphElement>(null)
  const lastPath = useRef(location.pathname)
  useRoleHome()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog, drawer or menu is open: its own keys come first.
      if (
        e.defaultPrevented ||
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]',
        )
      )
        return
      const combo = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (combo || (e.key === '/' && !isTyping(e.target))) {
        e.preventDefault()
        setSearchOpen(true)
      } else if (
        e.key === '[' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTyping(e.target) &&
        window.matchMedia(DESKTOP_QUERY).matches
      ) {
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarCollapsed, setSidebarCollapsed])

  // New page: move focus to the content and announce its title.
  useEffect(() => {
    // Only a real page change (also keeps React's dev double-run harmless).
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    // A page may focus its own first field (the reception scan box).
    if (!mainRef.current?.contains(document.activeElement))
      mainRef.current?.focus({ preventScroll: true })
    const id = window.setTimeout(() => {
      if (announcer.current) announcer.current.textContent = document.title
    }, 150)
    return () => window.clearTimeout(id)
  }, [location.pathname])

  return (
    <LucideProvider size={16} strokeWidth={2}>
      <div className="min-h-dvh bg-canvas text-fg" data-density={density}>
        <a
          href="#main"
          className="sr-only rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]"
        >
          {t('skipToContent')}
        </a>
        <Sidebar />
        <MobileNav open={navOpen} onOpenChange={setNavOpen} />
        <div
          className={cn(
            'flex min-h-dvh flex-col transition-[padding] duration-200',
            'md:pl-[72px]',
            !sidebarCollapsed && 'lg:pl-64',
          )}
        >
          <Header
            onOpenSearch={() => setSearchOpen(true)}
            onOpenNav={() => setNavOpen(true)}
          />
          <p ref={announcer} aria-live="polite" className="sr-only" />
          <main
            ref={mainRef}
            id="main"
            tabIndex={-1}
            className="flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6"
          >
            <div
              key={location.pathname}
              className="mx-auto w-full max-w-[2560px]"
            >
              <ModuleGate>
                <Outlet />
              </ModuleGate>
            </div>
          </main>
        </div>
        <BottomNav
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNav={() => setNavOpen(true)}
        />
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        <DrawerHost />
        <ErrorBoundary fallback={() => null}>
          <LabAssistant />
        </ErrorBoundary>
      </div>
    </LucideProvider>
  )
}
