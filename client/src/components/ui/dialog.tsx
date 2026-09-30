import { XIcon } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { useReturnFocus } from './return-focus'

interface OverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Rendered next to the title (badges, meta). */
  headerExtra?: ReactNode
  className?: string
}

function CloseButton() {
  const t = useT('common')
  return (
    <D.Close
      aria-label={t('close')}
      className="tap-reach grid size-9 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <XIcon className="size-4" />
    </D.Close>
  )
}

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

/** Modal dialog for confirmations and short forms. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerExtra,
  size = 'md',
  className,
}: OverlayProps & { size?: keyof typeof WIDTHS }) {
  const focus = useReturnFocus(open)
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay backdrop-blur-sm" />
        <D.Content
          {...focus}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(88dvh,52rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-dialog flex-col rounded-xl border border-line bg-surface shadow-modal outline-none',
            WIDTHS[size],
            className,
          )}
        >
          <div className="flex items-start gap-3 px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <D.Title className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
                {title}
                {headerExtra}
              </D.Title>
              {description ? (
                <D.Description className="mt-1 text-meta text-fg-muted">
                  {description}
                </D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <CloseButton />
          </div>
          {children ? (
            <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 pb-5">
              {children}
            </div>
          ) : null}
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">
              {footer}
            </div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

const DRAWER_WIDTHS = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
} as const

/** Side sheet for details and quick actions. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerExtra,
  size = 'lg',
  className,
}: OverlayProps & { size?: keyof typeof DRAWER_WIDTHS }) {
  const focus = useReturnFocus(open)
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay" />
        <D.Content
          {...focus}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full animate-drawer flex-col border-l border-line bg-surface shadow-card-lg outline-none',
            DRAWER_WIDTHS[size],
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-6 py-4">
            <div className="min-w-0 flex-1">
              <D.Title className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
                {title}
                {headerExtra}
              </D.Title>
              {description ? (
                <D.Description className="mt-1 text-meta text-fg-muted">
                  {description}
                </D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 py-5">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">
              {footer}
            </div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const DialogClose = D.Close
