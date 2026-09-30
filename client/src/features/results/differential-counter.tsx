import { CalculatorIcon, RotateCcwIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { DIFFERENTIAL } from './differential'

const TARGET = 100

/**
 * A manual differential count on a smear: tap a cell type (or press 1-5)
 * for each cell seen, up to 100 cells. The counts become the percentages.
 * Backspace removes the last cell counted.
 */
export function DifferentialCounter({
  names,
  onApply,
  disabled,
}: {
  names: Record<string, string>
  onApply: (percentages: Record<string, string>) => void
  disabled?: boolean
}) {
  const t = useT('results')
  const [cells, setCells] = useState<string[]>([])
  const counts = Object.fromEntries(
    DIFFERENTIAL.map((d) => [d.id, cells.filter((c) => c === d.id).length]),
  )
  const total = cells.length
  const add = (id: string) =>
    setCells((prev) => (prev.length >= TARGET ? prev : [...prev, id]))
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const hit = DIFFERENTIAL.find((d) => d.key === ev.key)
    if (hit) {
      ev.preventDefault()
      add(hit.id)
    } else if (ev.key === 'Backspace') {
      ev.preventDefault()
      setCells((prev) => prev.slice(0, -1))
    }
  }
  return (
    <details className="group/diff border-t border-line px-5 py-3">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium text-accent-text hover:underline">
        <CalculatorIcon className="size-4" aria-hidden />
        {t('diffCounter')}
      </summary>
      <div
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={t('diffCounterHint')}
        className="focus-ring mt-3 grid gap-3 rounded-lg border border-line p-3"
      >
        <p className="text-xs text-fg-muted">{t('diffCounterHint')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {DIFFERENTIAL.map((d) => (
            <Button
              key={d.id}
              type="button"
              disabled={disabled || total >= TARGET}
              onClick={() => add(d.id)}
              className="h-auto min-h-14 flex-col gap-0.5 py-2"
            >
              <span className="text-xs font-medium text-fg-muted">
                {d.key} · {names[d.id] ?? d.id}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {counts[d.id]}
              </span>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={cn(
              'text-sm font-semibold tabular-nums',
              total === TARGET ? 'text-success-text' : 'text-fg',
            )}
          >
            {t('diffTotal', { count: total, target: TARGET })}
          </span>
          <Button
            size="xs"
            variant="ghost"
            disabled={total === 0}
            onClick={() => setCells([])}
          >
            <RotateCcwIcon />
            {t('diffReset')}
          </Button>
          <Button
            size="xs"
            variant="primary"
            className="ml-auto"
            disabled={disabled || total === 0}
            onClick={() =>
              onApply(
                Object.fromEntries(
                  DIFFERENTIAL.map((d) => [
                    d.id,
                    String(Math.round((counts[d.id]! / total) * 100)),
                  ]),
                ),
              )
            }
          >
            {t('diffApply')}
          </Button>
        </div>
      </div>
    </details>
  )
}
