import { BadgeCheckIcon } from 'lucide-react'
import { IndostatesLogo, Logo } from '@/components/ui/logo'
import { INDOSTATES } from '@/lib/brand'
import { ageFromDob } from '@/domain/time'
import type { LabSettings, Language } from '@/domain/types'
import { translate, translateEnum } from '@/i18n/core'
import { createFormatter } from '@/i18n/format'
import { formatRange } from '@/domain/reference-ranges'
import type { PublicLabReport as ReportDetail } from '@/services/lab-api'
import { cn } from '@/lib/cn'
import {
  PatientSummary,
  VerificationBlock,
} from '@/components/lab/documents/report-blocks'
import {
  performedByText,
  summaryLanguages,
} from '@/components/lab/documents/report-extras'
import {
  cssString,
  pageOfContent,
  usePageRules,
} from '@/components/ui/page-margins'

type Kind = 'draft' | 'preliminary' | 'final' | 'amended' | 'withdrawn'
const KIND_KEY = {
  draft: 'kindDraft',
  preliminary: 'kindPreliminary',
  final: 'kindFinal',
  amended: 'kindAmended',
  withdrawn: 'kindWithdrawn',
} as const satisfies Record<Kind, string>
/** Statuses in which a version has gone to the ordering doctor. */
const ISSUED = new Set<ReportDetail['status']>([
  'preliminary',
  'released',
  'amendment-pending',
  'corrected',
  'withdrawn',
])
const MARGIN_TEXT = [
  "font: 7.5pt 'Plus Jakarta Sans Variable', 'Noto Sans Kannada Variable',",
  "'Noto Sans Devanagari Variable', 'Noto Sans Tamil Variable',",
  "'Noto Sans Malayalam Variable', sans-serif; color: #5b6670;",
].join(' ')

function flagText(lang: Language, flag: string | null) {
  if (!flag || flag === 'NORMAL' || flag === 'NEGATIVE') return ''
  return translateEnum(lang, 'flagShort', flag)
}

/** Printable A4 laboratory report. */
export function ReportSheet({
  report,
  lang,
  now,
  lab,
}: {
  report: ReportDetail
  lang: Language
  now: number
  lab?:
    | (Pick<
        LabSettings,
        | 'labName'
        | 'reportHeader'
        | 'reportFooter'
        | 'labAddress'
        | 'labRegistration'
        | 'labAccreditation'
      > &
        Partial<Pick<LabSettings, 'patientSummaryOnReport'>>)
    | undefined
}) {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(lang, 'reports', key, params)
  const e = (group: string, value: string) => translateEnum(lang, group, value)
  const f = createFormatter(lang)
  const tc = (key: string, params?: Record<string, string | number>) =>
    translate(lang, 'common', key, params)
  const p = report.patient
  const age = ageFromDob(p.dob, now)
  // Infants are reported in months or days, never as "0 y".
  const ageText =
    age.years >= 2
      ? tc('ageYears', { years: age.years })
      : age.years >= 1 || age.months >= 1
        ? tc('ageMonths', { months: age.years * 12 + age.months })
        : tc('ageDays', { days: age.days })
  const issued = ISSUED.has(report.status)
  const latest = report.versions.at(-1)
  const previous = report.versions.at(-2)
  const kind: Kind =
    report.status === 'withdrawn'
      ? 'withdrawn'
      : !issued
        ? 'draft'
        : (latest?.kind ?? (report.version > 1 ? 'amended' : 'final'))
  const kindLabel = t(KIND_KEY[kind])
  const releasedCount = report.sections.filter((s) => s.released).length
  // A preliminary report must not show values that were not released.
  const shown = (itemId: string) =>
    !issued || report.sections.some((s) => s.itemId === itemId && s.released)
  const criticals = report.criticals.filter((c) => shown(c.itemId))
  const collectedAt = Math.min(
    ...report.samples.map((s) => s.collectedAt ?? Infinity),
  )
  // Running header and footer on every printed page (ISO 15189 7.4.1.6):
  // the patient and report identity, and "Page x of y".
  const pageOf = pageOfContent(
    t('pageOf', { page: '{page}', pages: '{pages}' }),
  )
  const footerLeft = [
    Number.isFinite(collectedAt)
      ? t('runningCollected', { time: f.dateTime(collectedAt) })
      : '',
    report.reportedAt && issued
      ? t('runningIssued', { time: f.dateTime(report.reportedAt) })
      : kindLabel,
  ]
    .filter(Boolean)
    .join(' · ')
  usePageRules(
    [
      '@page {',
      `  @top-left { content: ${cssString(`${p.name} · ${t('uhid')} ${p.uhid} · ${ageText} / ${e('sexShort', p.sex)}`)}; ${MARGIN_TEXT} }`,
      `  @top-right { content: ${cssString(`${report.reportNo} · ${t('version', { version: report.version })} · ${kindLabel}`)}; ${MARGIN_TEXT} }`,
      `  @bottom-left { content: ${cssString(footerLeft)}; ${MARGIN_TEXT} }`,
      `  @bottom-right { content: ${pageOf}; ${MARGIN_TEXT} }`,
      '}',
      // The first page carries the full header already.
      '@page :first { @top-left { content: none } @top-right { content: none } }',
    ].join('\n'),
  )
  const valueText = (row: ReportDetail['sections'][number]['rows'][number]) => {
    if (!row.value) return ''
    if (row.resultType === 'posneg') {
      const style = row.posnegStyle ?? 'positive'
      const v = row.value === 'positive' ? 'positive' : 'negative'
      return e(
        style === 'reactive'
          ? 'reactive'
          : style === 'detected'
            ? 'detected'
            : 'posneg',
        v,
      )
    }
    if (row.resultType === 'antibiogram') {
      try {
        return Object.entries(JSON.parse(row.value) as Record<string, string>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      } catch {
        return row.value
      }
    }
    return row.value
  }
  const watermark =
    kind === 'draft'
      ? t('draftWatermark')
      : kind === 'withdrawn'
        ? t('withdrawnWatermark')
        : null
  const signers = (people: ReportDetail['reviewers']) =>
    people
      .map(
        (x) =>
          `${x.name}${x.qualification ? `, ${x.qualification}` : ''} (${f.dateTime(x.at)})`,
      )
      .join('; ')
  const location = report.order.ward
    ? `${report.order.ward}${report.order.bed ? ` / ${report.order.bed}` : ''}`
    : e('encounter', report.order.encounter)
  const multiSample = report.samples.length > 1
  // Tests outside the NABL scope carry an asterisk explained under the table.
  const notAccredited = report.sections.some(
    (s) => s.notAccredited && (!issued || s.released),
  )
  const sample = report.samples[0]
  const expectedText = (
    row: ReportDetail['sections'][number]['rows'][number],
  ) => {
    if (row.resultType === 'numeric')
      return formatRange(row.range) ?? t('notEstablished')
    if (!row.expected?.length) return ''
    if (row.resultType === 'posneg') {
      const style = row.posnegStyle ?? 'positive'
      return e(
        style === 'reactive'
          ? 'reactive'
          : style === 'detected'
            ? 'detected'
            : 'posneg',
        'negative',
      )
    }
    return row.expected.join(', ')
  }
  return (
    <article
      lang={lang}
      className="relative mx-auto w-full max-w-[210mm] min-w-[180mm] bg-[#ffffff] px-[14mm] py-[12mm] text-[10pt] leading-snug text-[#141a1f] shadow-overlay print:shadow-none"
    >
      {watermark ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
        >
          <span
            className={cn(
              '-rotate-30 text-[48pt] font-bold tracking-widest uppercase',
              kind === 'withdrawn'
                ? 'text-[#b91c1c]/[0.09]'
                : 'text-[#141a1f]/[0.05]',
            )}
          >
            {watermark}
          </span>
        </span>
      ) : null}
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#2563eb] pb-4">
        <div className="flex items-start gap-3">
          <Logo className="size-11" />
          <div>
            <p className="text-[15pt] leading-none font-bold tracking-wide text-[#1e3a8a]">
              {lab?.labName ?? t('brand')}
            </p>
            <p className="mt-1 text-[9pt] text-[#4a5560]">
              {t('brandSub')} · {t('brandLab')}
            </p>
            {lab?.labAddress ? (
              <p className="mt-0.5 text-[8pt] text-[#5b6670]">
                {lab.labAddress}
              </p>
            ) : null}
            {lab?.labRegistration || lab?.labAccreditation ? (
              <p className="text-[8pt] text-[#5b6670]">
                {[
                  lab.labRegistration
                    ? t('registrationNo', { value: lab.labRegistration })
                    : '',
                  lab.labAccreditation ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            {lab?.reportHeader ? (
              <p className="mt-0.5 text-[8pt] text-[#5b6670]">
                {lab.reportHeader}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-right text-[8.5pt] text-[#4a5560]">
          <IndostatesLogo alt={INDOSTATES.name} className="mb-2 h-[30px]" />
          <p className="font-mono text-[10pt] font-bold whitespace-nowrap text-[#141a1f]">
            {report.reportNo}
          </p>
          <p>{e('department', report.department)}</p>
          <p
            className={cn(
              'mt-1 text-[8pt] font-bold tracking-[0.12em] uppercase',
              kind === 'withdrawn'
                ? 'text-[#b91c1c]'
                : kind === 'final'
                  ? 'text-[#1e3a8a]'
                  : 'text-[#b45309]',
            )}
          >
            {kindLabel}
          </p>
          <p>{t('version', { version: report.version })}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-lg bg-[#f3f6f7] px-4 py-3 text-[9pt]">
        {[
          [t('patient'), <strong key="n">{p.name}</strong>],
          [
            t('uhid'),
            <span key="u" className="font-mono">
              {p.uhid}
            </span>,
          ],
          [t('ageSex'), `${ageText} / ${e('sexShort', p.sex)}`],
          [t('doctor'), report.order.doctor.name],
          [
            t('department'),
            e('clinicalDepartment', report.order.clinicalDepartment),
          ],
          [t('location'), location],
          ...(report.order.visitNo
            ? [
                [
                  t('visitNo'),
                  <span key="v" className="font-mono">
                    {report.order.visitNo}
                  </span>,
                ] as const,
              ]
            : []),
        ].map(([label, value], i) => (
          <div key={i} className="flex gap-2">
            <span className="w-24 shrink-0 text-[#5b6670]">{label}</span>
            <span className="min-w-0 text-[#141a1f]">{value}</span>
          </div>
        ))}
      </section>
      <section className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1 px-4 text-[8.5pt] text-[#4a5560]">
        <p>
          {t('specimen')}:{' '}
          <span className="text-[#141a1f]">
            {report.samples.map((s) => e('specimen', s.specimen)).join(', ')}
          </span>
        </p>
        <p>
          {t('sampleId')}:{' '}
          <span className="font-mono whitespace-nowrap text-[#141a1f]">
            {report.samples
              .map((s) => s.accessionNo)
              .filter(Boolean)
              .join(', ')}
          </span>
        </p>
        <p>
          {t('orderNo')}:{' '}
          <span className="font-mono whitespace-nowrap text-[#141a1f]">
            {report.order.orderNo}
          </span>
        </p>
        {multiSample ? null : (
          <>
            <p>
              {t('collected')}:{' '}
              <span className="whitespace-nowrap text-[#141a1f]">
                {sample?.collectedAt ? f.dateTime(sample.collectedAt) : '-'}
              </span>
            </p>
            <p>
              {t('received')}:{' '}
              <span className="whitespace-nowrap text-[#141a1f]">
                {sample?.receivedAt ? f.dateTime(sample.receivedAt) : '-'}
              </span>
            </p>
          </>
        )}
        <p>
          {t('reported')}:{' '}
          <span className="whitespace-nowrap text-[#141a1f]">
            {report.reportedAt ? f.dateTime(report.reportedAt) : '-'}
          </span>
        </p>
      </section>

      {multiSample ? (
        <table className="mt-2 w-full text-[8pt] text-[#4a5560]">
          <thead>
            <tr className="text-left">
              <th className="py-0.5 pr-2 pl-4 font-semibold">
                {t('sampleId')}
              </th>
              <th className="py-0.5 pr-2 font-semibold">{t('specimen')}</th>
              <th className="py-0.5 pr-2 font-semibold">{t('collected')}</th>
              <th className="py-0.5 font-semibold">{t('received')}</th>
            </tr>
          </thead>
          <tbody>
            {report.samples.map((s) => (
              <tr key={s.id} className="text-[#141a1f]">
                <td className="py-0.5 pr-2 pl-4 font-mono">{s.accessionNo}</td>
                <td className="py-0.5 pr-2">{e('specimen', s.specimen)}</td>
                <td className="py-0.5 pr-2">
                  {s.collectedAt ? f.dateTime(s.collectedAt) : '-'}
                </td>
                <td className="py-0.5">
                  {s.receivedAt ? f.dateTime(s.receivedAt) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {kind === 'withdrawn' && report.withdrawn ? (
        <p className="mt-3 rounded-md border-2 border-[#b91c1c] bg-[#fef2f2] px-3 py-2 text-[9pt] font-semibold text-[#991b1b]">
          {t('withdrawnNotice', {
            time: f.dateTime(report.withdrawn.at),
            name: report.withdrawn.byName,
            reason: report.withdrawn.reason.replace(/[.\s]+$/, ''),
          })}
        </p>
      ) : null}
      {kind === 'preliminary' ? (
        <p className="mt-3 rounded-md border border-[#f59e0b]/60 bg-[#fffbeb] px-3 py-1.5 text-[8.5pt] font-semibold text-[#92400e]">
          {t('preliminaryNotice', {
            released: releasedCount,
            total: report.testCount,
          })}
        </p>
      ) : null}
      {kind === 'amended' && latest ? (
        <div className="mt-3 rounded-md border border-[#f59e0b]/60 bg-[#fffbeb] px-3 py-1.5 text-[8.5pt] text-[#92400e]">
          <p className="font-semibold">
            {t('amendedNotice', {
              version: latest.version,
              previous: previous?.version ?? latest.version - 1,
              time: previous ? f.dateTime(previous.releasedAt) : '-',
            })}
          </p>
          {latest.correctionReason ? (
            <p>
              {t('amendedReason', {
                reason: [
                  e('correctionReason', latest.correctionReason),
                  latest.correctionComments,
                ]
                  .filter(Boolean)
                  .join(': '),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-5 mb-2 text-[9pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
        {t('results')}
      </h2>
      <table className="w-full border-collapse text-[9pt]">
        <thead>
          <tr className="border-y border-[#c9d2d8] text-left text-[8pt] text-[#5b6670] uppercase">
            <th className="py-1.5 pr-2 font-semibold">{t('test')}</th>
            <th className="py-1.5 pr-2 text-right font-semibold">
              {t('result')}
            </th>
            <th className="py-1.5 pr-2 font-semibold">{t('unit')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('range')}</th>
            <th className="py-1.5 font-semibold">{t('flag')}</th>
          </tr>
        </thead>
        {report.sections.map((section) => (
          <tbody key={section.itemId} className="print-avoid-break">
            <tr>
              <td colSpan={5} className="pt-3 pb-1 font-bold text-[#141a1f]">
                {section.testName}
                {section.notAccredited ? (
                  <sup className="ml-0.5 font-bold">
                    *<span className="sr-only">{t('notAccreditedLabel')}</span>
                  </sup>
                ) : null}
                {section.method ? (
                  <span className="ml-2 text-[7.5pt] font-normal text-[#5b6670]">
                    {t('method')}: {section.method}
                  </span>
                ) : null}
                {section.performedBy ? (
                  <span className="block text-[7.5pt] font-normal text-[#4a5560]">
                    {performedByText(lang, section.performedBy)}
                  </span>
                ) : null}
              </td>
            </tr>
            {issued && !section.released ? (
              <tr className="border-b border-[#e3e8eb]">
                <td
                  colSpan={5}
                  className="py-1 pl-3 text-[8.5pt] text-[#5b6670] italic"
                >
                  {t('toFollow')}
                </td>
              </tr>
            ) : null}
            {(issued && !section.released ? [] : section.rows).map((row) => {
              const flag = flagText(lang, row.flag)
              const abnormal = Boolean(flag)
              const prev = row.previousVersions.at(-1)
              return (
                <tr
                  key={row.resultId}
                  className="border-b border-[#e3e8eb] align-top"
                >
                  <td className="py-1 pr-2 pl-3 text-[#2b343c]">
                    {row.name}
                    {prev ? (
                      <span className="block text-[7.5pt] text-[#b45309]">
                        {t('previouslyReported', {
                          version: prev.version,
                          value: prev.value,
                        })}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      'py-1 pr-2 text-right tabular-nums',
                      abnormal && 'font-bold',
                    )}
                  >
                    {valueText(row)}
                  </td>
                  <td className="py-1 pr-2 text-[#5b6670]">{row.unit}</td>
                  <td className="py-1 pr-2 text-[#5b6670] tabular-nums">
                    {expectedText(row)}
                  </td>
                  <td
                    className={cn(
                      'py-1 font-bold',
                      row.flag?.startsWith('CRITICAL')
                        ? 'text-[#b91c1c]'
                        : 'text-[#92400e]',
                    )}
                  >
                    {flag}
                  </td>
                </tr>
              )
            })}
            {section.comments.length && shown(section.itemId) ? (
              <tr>
                <td
                  colSpan={5}
                  className="pt-1 pb-2 pl-3 text-[8.5pt] text-[#4a5560] italic"
                >
                  {section.comments.join(' ')}
                </td>
              </tr>
            ) : null}
          </tbody>
        ))}
      </table>
      {notAccredited ? (
        <p className="mt-1.5 text-[7.5pt] text-[#4a5560]">
          * {t('notAccreditedFootnote')}
        </p>
      ) : null}

      {criticals.length ? (
        <section className="print-avoid-break mt-4 rounded-md border border-[#b91c1c]/40 px-3 py-2">
          <h3 className="text-[8.5pt] font-bold tracking-[0.12em] text-[#b91c1c] uppercase">
            {t('criticalsTitle')}
          </h3>
          <ul className="mt-1 grid gap-0.5 text-[8.5pt] text-[#141a1f]">
            {criticals.map((c, i) => {
              const what = `${c.analyteName} ${c.value}${c.unit ? ` ${c.unit}` : ''}`
              if (!c.notifiedAt || !c.notifiedTo)
                return <li key={i}>{t('criticalNotYet', { what })}</li>
              const params = {
                what,
                method: c.method
                  ? e('notifyMethod', c.method)
                  : t('criticalNotified'),
                who: c.notifiedRole
                  ? `${c.notifiedTo} (${e('notifyRole', c.notifiedRole)})`
                  : c.notifiedTo,
                time: f.dateTime(c.notifiedAt),
              }
              return (
                <li key={i}>
                  {t(
                    c.readBack ? 'criticalLineReadBack' : 'criticalLine',
                    params,
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {report.interpretation ? (
        <section className="print-avoid-break mt-5">
          <h3 className="text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
            {t('interpretation')}
          </h3>
          <p className="mt-1 text-[9pt]">{report.interpretation}</p>
        </section>
      ) : null}

      {lab?.patientSummaryOnReport && kind !== 'withdrawn' ? (
        <PatientSummary
          report={report}
          langs={summaryLanguages(p.preferredLanguage, lang)}
          includeUnreleased={!issued}
          className="mt-5"
        />
      ) : null}

      <footer className="print-avoid-break mt-8 flex items-end justify-between gap-6 border-t border-[#c9d2d8] pt-4">
        <div className="min-w-0 flex-1 text-[8pt] text-[#5b6670]">
          <p>{t('generated', { time: f.dateTime(now) })}</p>
          {report.enteredBy.length ? (
            <p>{t('analysedBy', { names: report.enteredBy.join(', ') })}</p>
          ) : null}
          {report.reviewers.length ? (
            <p>{t('reviewedByLine', { names: signers(report.reviewers) })}</p>
          ) : null}
          {report.authorisers.length ? (
            <p>
              {t('authorisedByLine', { names: signers(report.authorisers) })}
            </p>
          ) : null}
          {lab?.reportFooter ? (
            <p className="mt-1 max-w-[95mm]">{lab.reportFooter}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right whitespace-nowrap">
          {report.pathologist ? (
            <>
              <p className="inline-flex items-center gap-1 text-[8pt] font-semibold text-[#1d4ed8]">
                <BadgeCheckIcon strokeWidth={2.2} className="size-3.5" />
                {t('signature')}
              </p>
              <p className="mt-1 font-[cursive] text-[13pt] text-[#1e3a8a] italic">
                {report.pathologist.name}
              </p>
              <p className="text-[9pt] font-semibold">
                {report.pathologist.name}
              </p>
              <p className="text-[8pt] text-[#5b6670]">
                {report.pathologist.qualification}
              </p>
              {latest ? (
                <p className="text-[8pt] text-[#5b6670]">
                  {t('releasedOn', { time: f.dateTime(latest.releasedAt) })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[8pt] text-[#5b6670]">{t('notSigned')}</p>
          )}
        </div>
      </footer>
      {report.seal ? (
        <VerificationBlock
          seal={report.seal}
          scanLabel={translate(lang, 'portal', 'scanToVerify')}
          digestLabel={translate(lang, 'portal', 'digest')}
          className="mt-4"
        />
      ) : null}
      <p className="mt-3 text-[8pt] font-semibold tracking-[0.2em] text-[#5b6670] uppercase">
        {t('endOfReport')}
      </p>
    </article>
  )
}
