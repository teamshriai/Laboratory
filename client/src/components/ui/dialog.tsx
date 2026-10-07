import { XIcon } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { focusOnOpen, useReturnFocus } from './return-focus'

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

function CloseButton({
  onClick,
}: {
  onClick?: ((ev: React.MouseEvent) => void) | undefined
}) {
  const t = useT('common')
  return (
    <D.Close
      aria-label={t('close')}
      onClick={onClick}
      className="tap-reach grid size-9 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      <XIcon className="size-4" />
    </D.Close>
  )
}

interface SurfaceProps extends Omit<OverlayProps, 'open' | 'onOpenChange'> {
  open: boolean
  onClose: () => void
  /** Unsaved input: Esc, a click outside or the close button ask first. */
  dirty?: boolean | undefined
  contentClassName: string
  headerClassName: string
  bodyClassName: string
}

/**
 * The dialog or drawer panel. Mounted only while open, so a pending "discard
 * changes?" question never outlives the dialog.
 */
function Surface({
  open,
  onClose,
  dirty,
  title,
  description,
  children,
  footer,
  headerExtra,
  contentClassName,
  headerClassName,
  bodyClassName,
}: SurfaceProps) {
  const t = useT('common')
  const panel = useRef<HTMLDivElement>(null)
  const focus = useReturnFocus(open, panel)
  const [confirming, setConfirming] = useState(false)
  const guard = (ev: Event) => {
    if (!dirty) return
    ev.preventDefault()
    setConfirming(true)
  }
  return (
    <D.Content
      ref={panel}
      {...focus}
      onOpenAutoFocus={focusOnOpen}
      onEscapeKeyDown={guard}
      onInteractOutside={guard}
      className={contentClassName}
    >
      <div className={headerClassName}>
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
        <CloseButton
          onClick={
            dirty
              ? (ev) => {
                  ev.preventDefault()
                  setConfirming(true)
                }
              : undefined
          }
        />
      </div>
      {children ? <div className={bodyClassName}>{children}</div> : null}
      {confirming ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-end gap-2 border-t border-warning-text/25 bg-warning-soft px-6 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
        >
          <p className="mr-auto text-meta font-medium text-warning-text">
            {t('unsavedTitle')}
          </p>
          <Button
            variant="ghost"
            autoFocus
            onClick={() => setConfirming(false)}
          >
            {t('unsavedStay')}
          </Button>
          <Button variant="danger" onClick={onClose}>
            {t('unsavedDiscard')}
          </Button>
        </div>
      ) : footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </D.Content>
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
  size = 'md',
  className,
  dirty,
  ...rest
}: OverlayProps & { size?: keyof typeof WIDTHS; dirty?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay backdrop-blur-sm" />
        <Surface
          {...rest}
          open={open}
          dirty={dirty}
          onClose={() => onOpenChange(false)}
          contentClassName={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(88dvh,52rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-dialog flex-col rounded-xl border border-line bg-surface shadow-modal outline-none',
            WIDTHS[size],
            className,
          )}
          headerClassName="flex items-start gap-3 px-6 pt-5 pb-4"
          bodyClassName="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 pb-5"
        />
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
  size = 'lg',
  className,
  dirty,
  ...rest
}: OverlayProps & { size?: keyof typeof DRAWER_WIDTHS; dirty?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay" />
        <Surface
          {...rest}
          open={open}
          dirty={dirty}
          onClose={() => onOpenChange(false)}
          contentClassName={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full animate-drawer flex-col border-l border-line bg-surface shadow-card-lg outline-none',
            DRAWER_WIDTHS[size],
            className,
          )}
          headerClassName="flex items-start gap-3 border-b border-line px-6 py-4"
          bodyClassName="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 py-5"
        />
      </D.Portal>
    </D.Root>
  )
}

export const DialogClose = D.Close
