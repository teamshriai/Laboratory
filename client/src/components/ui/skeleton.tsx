import { cn } from '@/lib/cn'
import { Card } from './card'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} />
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div role="status" aria-busy className="divide-y divide-line">
      <div className="flex gap-6 bg-surface-2/70 px-5 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3 flex-1', c % 2 ? 'max-w-24' : '')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({
  className,
  lines = 4,
}: {
  className?: string
  lines?: number
}) {
  return (
    <Card className={cn('p-5', className)}>
      <Skeleton className="mb-4 h-4 w-40" />
      <SkeletonText lines={lines} />
    </Card>
  )
}

export function KpiSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  )
}
