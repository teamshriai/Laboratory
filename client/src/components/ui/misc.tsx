import { CheckIcon, LucideProvider } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const AVATAR_TONES = [
  'bg-accent-soft text-accent-text',
  'bg-info-soft text-info-text',
  'bg-warning-soft text-warning-text',
  'bg-success-soft text-success-text',
  'bg-danger-soft text-danger-text',
  'bg-neutral-soft text-neutral-text',
]

export function initials(name: string) {
  const parts = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const tone = AVATAR_TONES[hash(name) % AVATAR_TONES.length]
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold tracking-tight select-none',
        tone,
        size === 'sm' && 'size-7 text-2xs',
        size === 'md' && 'size-9 text-xs',
        size === 'lg' && 'size-12 text-sm',
        size === 'xl' && 'size-16 text-lg',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function Kbd({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-2xs font-medium text-fg-muted shadow-card',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export interface TimelineEntry {
  id: string
  title: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
}

const DOT_TONES = {
  accent: 'text-ic-teal',
  success: 'text-ic-green',
  warning: 'text-ic-amber',
  danger: 'text-ic-rose',
  neutral: 'text-ic-slate',
}

export function Timeline({
  items,
  className,
}: {
  items: TimelineEntry[]
  className?: string
}) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 ? (
            <span
              aria-hidden
              className="absolute top-7 bottom-0 left-[13px] w-px bg-line"
            />
          ) : null}
          <span
            className={cn(
              'relative grid size-7 shrink-0 place-items-center bg-surface [&_svg]:size-5',
              DOT_TONES[item.tone ?? 'neutral'],
            )}
          >
            {item.icon ? (
              <LucideProvider strokeWidth={1.8}>{item.icon}</LucideProvider>
            ) : (
              <span className="size-2 rounded-full bg-current" />
            )}
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-sm text-fg">{item.title}</p>
            {item.meta ? (
              <p className="mt-0.5 text-xs text-fg-muted">{item.meta}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: { id: string; label: ReactNode }[]
  current: number
  onStepClick?: (index: number) => void
  className?: string
}) {
  return (
    // Labels follow the stepper's own width: all of them when there is
    // room, otherwise only the current step's (the numbers stay).
    <ol className={cn('@container flex items-center gap-2', className)}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={step.id}
            className="flex min-w-0 flex-auto items-center gap-2 last:flex-none"
          >
            <button
              type="button"
              disabled={!onStepClick || i > current}
              onClick={() => onStepClick?.(i)}
              aria-current={active ? 'step' : undefined}
              className="group flex min-h-11 min-w-11 items-center gap-2.5 rounded-lg pr-1 text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-accent text-on-accent',
                  active &&
                    'bg-accent-soft text-accent-text ring-2 ring-accent',
                  !done && !active && 'bg-surface-3 text-fg-muted',
                )}
              >
                {done ? (
                  <CheckIcon strokeWidth={2.5} className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  // Visually hidden when there is no room, but always the
                  // step button's accessible name.
                  'truncate text-meta font-medium',
                  active
                    ? 'sr-only text-fg @[24rem]:not-sr-only'
                    : 'sr-only text-fg-muted @[40rem]:not-sr-only',
                  done && 'group-hover:text-fg',
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'h-px min-w-4 flex-1',
                  done ? 'bg-accent' : 'bg-line',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Horizontal proportion bar (no background track) used in compact tables. */
export function Meter({
  value,
  max,
  className,
  tone = 'accent',
}: {
  value: number
  max: number
  className?: string
  tone?: 'accent' | 'warning' | 'danger' | 'success'
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <span
      className={cn(
        'block h-1.5 overflow-hidden rounded-full bg-surface-3',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'block h-full rounded-full transition-[width] duration-500',
          tone === 'accent' && 'bg-accent',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-danger',
          tone === 'success' && 'bg-success',
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

export function Barcode({
  value,
  height = 44,
  className,
}: {
  value: string
  height?: number
  className?: string
}) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    let cancelled = false
    // Loaded on first use: only labels and report sheets draw barcodes.
    void import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled) return
      try {
        JsBarcode(svg, value, {
          format: 'CODE128',
          displayValue: false,
          height,
          margin: 0,
          width: 1.35,
          background: 'transparent',
          lineColor: '#141a1f',
        })
      } catch {
        // Invalid characters: leave the barcode empty rather than crash.
      }
    })
    return () => {
      cancelled = true
    }
  }, [value, height])
  return <svg ref={ref} className={className} role="img" aria-label={value} />
}
