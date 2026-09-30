import { LucideProvider } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { toneStyle, type IconTone } from '@/lib/icon-tones'

/**
 * Footprint and glyph size. The footprint keeps rows aligned; nothing is
 * drawn behind the glyph.
 */
const SIZES = {
  xs: { box: 'size-5', icon: 16 },
  sm: { box: 'size-6', icon: 20 },
  md: { box: 'size-7', icon: 22 },
  lg: { box: 'size-9', icon: 28 },
  xl: { box: 'size-12', icon: 40 },
}

/**
 * An icon in its destination hue: a transparent duotone glyph with no
 * container (the user's standing preference, over the design system's
 * tiles). `solid` gives the fill a little more weight, for navigation.
 */
export function IconTile({
  icon,
  tone = 'blue',
  size = 'sm',
  variant = 'soft',
  className,
  label,
}: {
  icon: ReactNode
  tone?: IconTone
  size?: keyof typeof SIZES
  variant?: 'soft' | 'solid'
  className?: string
  label?: string
}) {
  const s = SIZES[size]
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={toneStyle(tone)}
      className={cn(
        'duo-icon inline-flex shrink-0 items-center justify-center',
        variant === 'solid' && 'duo-strong',
        s.box,
        className,
      )}
    >
      <LucideProvider size={s.icon} strokeWidth={1.75}>
        {icon}
      </LucideProvider>
    </span>
  )
}

export function SoftIconTile(
  props: Omit<Parameters<typeof IconTile>[0], 'variant'>,
) {
  return <IconTile {...props} variant="soft" />
}

/** The same duotone glyph at an exact pixel size (list rows, table cells). */
export function IconGlyph({
  icon,
  tone = 'blue',
  size = 16,
  className,
}: {
  icon: ReactNode
  tone?: IconTone
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={toneStyle(tone)}
      className={cn(
        'duo-icon inline-grid shrink-0 place-items-center',
        className,
      )}
    >
      <LucideProvider size={size} strokeWidth={1.75}>
        {icon}
      </LucideProvider>
    </span>
  )
}
