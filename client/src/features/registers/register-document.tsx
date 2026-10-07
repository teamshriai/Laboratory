import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { LabSettings } from '@/domain/types'
import { Logo } from '@/components/ui/logo'
import {
  cssString,
  pageOfContent,
  usePageRules,
} from '@/components/ui/page-margins'
import type { RegisterTable } from './registers'

const MARGIN_TEXT = 'font-size: 7.5pt; color: #555;'

/**
 * A register as a printable landscape A4 document: the lab's identity and
 * registration number, the period, every entry and the signature line.
 * Print forces the light tokens, so a dark-theme session prints white paper.
 */
export function RegisterDocument({
  lab,
  title,
  period,
  notes,
  table,
  printedAt,
  printedBy,
}: {
  lab: Pick<LabSettings, 'labName' | 'labAddress' | 'labRegistration'> & {
    profile: Pick<
      LabSettings['profile'],
      'registrationNo' | 'registrationAuthority'
    >
  }
  title: string
  period: string
  notes: string[]
  table: RegisterTable
  printedAt: number
  printedBy: string
}) {
  const t = useT('registers')
  const f = useFormat()
  const registration = lab.profile.registrationNo || lab.labRegistration
  const pageOf = pageOfContent(
    t('printPageOf', { page: '{page}', pages: '{pages}' }),
  )
  usePageRules(
    [
      '@page {',
      '  size: A4 landscape;',
      '  margin: 10mm 10mm 12mm;',
      `  @bottom-left { content: ${cssString(`${lab.labName} · ${title} · ${period}`)}; ${MARGIN_TEXT} }`,
      `  @bottom-right { content: ${pageOf}; ${MARGIN_TEXT} }`,
      '}',
    ].join('\n'),
  )

  return (
    <article className="mx-auto w-full max-w-[297mm] bg-surface px-4 py-5 text-fg sm:px-[8mm] sm:py-[6mm]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-accent pb-3">
        <div className="flex items-start gap-3">
          <Logo className="size-10" />
          <div>
            <p className="text-[13pt] leading-tight font-bold text-accent-text">
              {lab.labName}
            </p>
            {lab.labAddress ? (
              <p className="text-[8pt] text-fg-muted">{lab.labAddress}</p>
            ) : null}
            <p className="text-[8pt] text-fg-muted">
              {registration
                ? t('printRegistration', { no: registration })
                : t('noRegistration')}
              {lab.profile.registrationAuthority
                ? ` · ${lab.profile.registrationAuthority}`
                : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11pt] font-bold text-fg">{title}</p>
          <p className="text-[9pt] text-fg-muted">
            {t('printPeriod', { period })}
          </p>
          <p className="text-[8pt] text-fg-muted">
            {t('entries', { count: table.rows.length })}
          </p>
        </div>
      </header>

      {notes.length ? (
        <div className="mt-2 grid gap-0.5 text-[7.5pt] text-fg-muted">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}

      <table className="mt-3 w-full border-collapse text-[7.5pt] leading-snug">
        <caption className="sr-only">{`${title} · ${period}`}</caption>
        <thead>
          <tr className="text-left align-bottom">
            {table.headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="border border-line-strong bg-surface-2 px-1.5 py-1 font-semibold text-fg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.length ? (
            table.rows.map((row, i) => (
              <tr key={i} className="print-avoid-break align-top">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="border border-line px-1.5 py-1 break-words text-fg"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={table.headers.length}
                className="border border-line px-1.5 py-3 text-center text-fg-muted"
              >
                {t('printNoEntries')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <footer className="print-avoid-break mt-10 grid gap-8 text-[9pt] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="h-10 border-b border-fg" />
          <p className="mt-1 text-fg">{t('printSignature')}</p>
          <p className="mt-3 text-fg-muted">{t('printName')}</p>
        </div>
        <div>
          <div className="h-10 border-b border-fg" />
          <p className="mt-1 text-fg">{t('printDate')}</p>
        </div>
        <p className="text-[7.5pt] text-fg-muted sm:col-span-2">
          {t('printedBy', { time: f.dateTime(printedAt), name: printedBy })}
        </p>
      </footer>
    </article>
  )
}
