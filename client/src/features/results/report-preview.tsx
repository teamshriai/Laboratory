import { Building2Icon, PrinterIcon } from 'lucide-react'
import type { Analyte } from '@/domain/types'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import type { EntryItem } from '@/services/lab-api'
import {
  RangeText,
  ResultFlag,
  useResultText,
  valueTone,
} from '@/components/lab/result'
import { Card } from '@/components/ui/card'
import {
  liveItem,
  liveRows,
  useAccreditation,
  type Values,
} from './entry-values'

/**
 * The report lines as they will print, live from the form: parameter,
 * value, unit, reference interval and flag, then the report comments.
 */
export function ReportPreview({
  items,
  values,
  comments,
  analytes,
  className,
}: {
  items: EntryItem[]
  values: Values
  /** Comments typed on this screen, saved with the results. */
  comments: Record<string, string>
  analytes: Record<string, Analyte>
  className?: string
}) {
  const t = useT('results')
  const text = useResultText()
  const accreditation = useAccreditation()
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <PrinterIcon className="size-4 text-accent-text" aria-hidden />
          {t('previewTitle')}
        </h2>
        <p className="mt-0.5 text-xs text-fg-muted">{t('previewHint')}</p>
      </div>
      <div
        role="region"
        aria-label={t('previewTitle')}
        tabIndex={0}
        className="focus-ring min-h-0 flex-1 scrollbar-thin divide-y divide-line overflow-y-auto"
      >
        {items.map((item) => {
          const rows = liveRows(
            item,
            liveItem(item, values[item.itemId]),
            analytes,
          ).filter((r) => r.required || r.value)
          const notes = [
            ...item.comments
              .filter((c) => c.visibility === 'report')
              .map((c) => c.text),
            comments[item.itemId]?.trim() ?? '',
          ].filter(Boolean)
          return (
            <section
              key={item.itemId}
              aria-label={item.testName}
              className="px-4 py-3"
            >
              <h3 className="text-meta font-semibold text-fg">
                {item.testName}
              </h3>
              {item.method ? (
                <p className="text-2xs text-fg-subtle">
                  {t('method', { method: item.method })}
                </p>
              ) : null}
              <table className="mt-1.5 w-full text-meta">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{t('colParameter')}</th>
                    <th scope="col">{t('colResult')}</th>
                    <th scope="col">{t('colFlag')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const numeric = r.analyte.resultType === 'numeric'
                    return (
                      <tr
                        key={r.analyte.id}
                        className="border-t border-line/60 align-top first:border-t-0"
                      >
                        <td className="py-1.5 pr-2">
                          <span className="block text-fg">
                            {r.analyte.name}
                            {r.calculated ? (
                              <span className="text-2xs text-fg-subtle">
                                {' '}
                                ({t('calculated')})
                              </span>
                            ) : null}
                          </span>
                          <RangeText
                            range={r.range}
                            analyte={r.analyte}
                            className="block text-2xs"
                          />
                        </td>
                        <td
                          className={cn(
                            'px-2 py-1.5 break-words',
                            numeric && 'text-right tabular-nums',
                            r.value ? valueTone(r.flag, r.critical) : '',
                          )}
                        >
                          {r.value ? (
                            text(r.value, r.analyte)
                          ) : (
                            <span className="text-fg-subtle">-</span>
                          )}
                          {r.analyte.unit ? (
                            <span className="block text-2xs font-normal text-fg-subtle">
                              {r.analyte.unit}
                            </span>
                          ) : null}
                        </td>
                        <td className="w-px py-1.5 pl-1">
                          <ResultFlag
                            flag={r.flag}
                            critical={r.critical}
                            variant="short"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {notes.length ? (
                <ul className="mt-2 grid gap-1 border-t border-line/60 pt-2 text-xs text-fg-muted">
                  {notes.map((note, i) => (
                    <li key={i}>
                      <span className="font-medium text-fg">
                        {t('previewComment')}:
                      </span>{' '}
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.performedBy ? (
                <p className="mt-2 flex items-start gap-1.5 text-2xs text-fg-subtle">
                  <Building2Icon
                    className="mt-px size-3.5 shrink-0"
                    aria-hidden
                  />
                  <span>
                    {t('performedByShort', {
                      lab: item.performedBy.name,
                      accreditation: accreditation(item.performedBy),
                    })}
                  </span>
                </p>
              ) : null}
            </section>
          )
        })}
      </div>
    </Card>
  )
}
