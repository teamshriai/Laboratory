import { cn } from '@/lib/cn'

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
      src={`${import.meta.env.BASE_URL}favicon-192.png`}
      alt={alt}
      width={192}
      height={192}
      decoding="async"
      className={cn('size-8 shrink-0 object-contain', className)}
    />
  )
}
