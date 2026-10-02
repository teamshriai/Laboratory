import { cn } from '@/lib/cn'

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

/** The SHRI HEALTH mark (the same image as the favicon). */
export function Logo({
  alt = '',
  className,
}: {
  alt?: string
  className?: string
}) {
  return (
    <img
      src={asset('favicon-192.png')}
      alt={alt}
      width={192}
      height={192}
      decoding="async"
      className={cn('size-8 shrink-0 object-contain', className)}
    />
  )
}

/**
 * The Indo States Health wordmark: a cropped copy of
 * public/logo-indostates.png. Its own white backing keeps the dark grey
 * lettering readable in dark mode; on light surfaces it is invisible.
 */
export function IndostatesLogo({
  alt = '',
  className,
}: {
  alt?: string
  className?: string
}) {
  return (
    <img
      src={asset('indostates-logo.webp')}
      alt={alt}
      width={617}
      height={132}
      decoding="async"
      className={cn('h-9 w-auto shrink-0 bg-white object-contain', className)}
    />
  )
}
