import {
  BadgeCheckIcon,
  BellRingIcon,
  InfoIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { formatRange } from '@/domain/reference-ranges'
import type { LabSettings } from '@/domain/types'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { PublicLabReport, ReportResultRow } from '@/services/lab-api'
import { IndostatesLogo, Logo } from '@/components/ui/logo'
import { INDOSTATES } from '@/lib/brand'
import { useAgeText } from '../patient'
import { useResultText } from '../result'
import { PatientSummary, VerificationBlock } from './report-blocks'
import {
  isAbnormalFlag,
  performedByText,
  summaryLanguages,
} from './report-extras'

type Lab = Pick<
  LabSettings,
  | 'labName'
  | 'labAddress'
  | 'labRegistration'
  | 'labAccreditation'
  | 'reportFooter'
> &
  Partial<Pick<LabSettings, 'patientSummaryOnReport'>>

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8pt] font-semibold tracking-[0.08em] text-[#5b6670] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[10pt] break-words text-[#141a1f]">
        {children}
      </dd>
    </div>
  )
}

/**
 * A laboratory report as the patient-facing page shows it: a readable
 * document on every screen (results stack on phones). Printing and the PDF
 * use the A4 `ReportSheet`, which carries the same content.
 */
export function LabDocument({
  report,
  lab,
}: {
  report: PublicLabReport
  lab?: Lab | undefined
}) {
  const t = useT('portal')
  const tr = useT('reports')
  const e = useEnum()
  const f = useFormat()
  const { language } = useLanguage()
  const age = useAgeText()
  const text = useResultText()
  const p = report.patient
  const sample = report.samples[0]
  const latest = report.versions.at(-1)
  const notAccredited = report.sections.some(
    (s) => s.notAccredited && s.released,
  )

  const interval = (row: ReportResultRow) => {
    if (row.resultType === 'numeric')
      return formatRange(row.range) ?? t('notEstablished')
    return row.expected?.length ? row.expected.join(', ') : ''
  }
  const flagLabel = (row: ReportResultRow) =>
    row.flag && isAbnormalFlag(row.flag) ? e('flag', row.flag) : ''

  return (
    <article className="relative mx-auto w-full max-w-[210mm] bg-[#ffffff] px-5 py-6 text-[#141a1f] shadow-overlay sm:px-[14mm] sm:py-[12mm]">
      <header className="flex flex-col gap-4 border-b-2 border-[#2563eb] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Logo className="size-11" />
          <div>
            <p className="text-[14pt] leading-tight font-bold text-[#1e3a8a]">
              {lab?.labName ?? tr('brand')}
            </p>
            <p className="mt-0.5 text-[9pt] text-[#4a5560]">
              {tr('brandSub')} · {e('department', report.department)}
            </p>
            {lab?.labAddress ? (
              <p className="text-[8pt] text-[#5b6670]">{lab.labAddress}</p>
            ) : null}
            {lab?.labRegistration || lab?.labAccreditation ? (
              <p className="text-[8pt] text-[#5b6670]">
                {[lab.labRegistration, lab.labAccreditation]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
          <IndostatesLogo alt={INDOSTATES.name} className="mb-2 h-[28px]" />
          <p className="font-mono text-[10pt] font-bold">{report.reportNo}</p>
          <p className="text-[8pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
            {e('reportStatus', report.status)} ·{' '}
            {t('version', { version: report.version })}
          </p>
        </div>
      </header>

      {report.supersededBy ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-[#d7dee3] bg-[#f3f6f7] px-3 py-2 text-[9pt]">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('superseded', { latest: report.supersededBy })}
        </p>
      ) : null}
      {report.status === 'preliminary' ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-[#f59e0b]/60 bg-[#fffbeb] px-3 py-2 text-[9pt] font-semibold text-[#92400e]">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {tr('preliminaryNotice', {
            released: report.sections.filter((s) => s.released).length,
            total: report.testCount,
          })}
        </p>
      ) : null}
      {latest?.kind === 'amended' && latest.correctionReason ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-[#f59e0b]/60 bg-[#fffbeb] px-3 py-2 text-[9pt] text-[#92400e]">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {tr('amendedReason', {
            reason: [
              e('correctionReason', latest.correctionReason),
              latest.correctionComments,
            ]
              .filter(Boolean)
              .join(': '),
          })}
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-[#f3f6f7] px-4 py-3.5 sm:grid-cols-3">
        <Meta label={t('patient')}>
          <strong>{p.name}</strong>
        </Meta>
        <Meta label={t('uhid')}>
          <span className="font-mono">{p.uhid}</span>
        </Meta>
        <Meta label={t('ageSex')}>
          {age(p.dob)} / {e('sexShort', p.sex)}
        </Meta>
        <Meta label={t('dob')}>{f.date(Date.parse(p.dob))}</Meta>
        <Meta label={t('referredBy')}>{report.order.doctor.name}</Meta>
        <Meta label={t('reported')}>
          {report.reportedAt ? f.dateTime(report.reportedAt) : '-'}
        </Meta>
      </dl>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 px-1 sm:grid-cols-3">
        <Meta label={t('specimen')}>
          {report.samples.map((s) => e('specimen', s.specimen)).join(', ')}
        </Meta>
        <Meta label={t('accession')}>
          <span className="font-mono">
            {report.samples
              .map((s) => s.accessionNo)
              .filter(Boolean)
              .join(', ')}
          </span>
        </Meta>
        <Meta label={t('collected')}>
          {sample?.collectedAt ? f.dateTime(sample.collectedAt) : '-'}
        </Meta>
      </dl>

      <h2 className="mt-6 border-b border-[#d7dee3] pb-1.5 text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
        {t('examinations')}
      </h2>
      {report.sections.map((section) => (
        <section key={section.itemId} className="mt-4">
          <h3 className="text-[10.5pt] font-semibold text-[#141a1f]">
            {section.testName}
            {section.notAccredited ? (
              <sup className="ml-0.5 font-bold">
                *<span className="sr-only">{tr('notAccreditedLabel')}</span>
              </sup>
            ) : null}
            {section.method ? (
              <span className="ml-2 text-[8pt] font-normal text-[#5b6670]">
                {tr('method')}: {section.method}
              </span>
            ) : null}
          </h3>
          {section.performedBy ? (
            <p className="mt-0.5 text-[8.5pt] text-[#4a5560]">
              {performedByText(language, section.performedBy)}
            </p>
          ) : null}
          {!section.released ? (
            <p className="mt-1 text-[9pt] text-[#5b6670] italic">
              {t('toFollow')}
            </p>
          ) : (
            <>
              {/* Wide screens: a table. Phones: one card per result. */}
              <table className="mt-1.5 hidden w-full border-collapse text-[9.5pt] sm:table">
                <thead>
                  <tr className="border-y border-[#c9d2d8] text-left text-[8pt] text-[#5b6670] uppercase">
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      {t('test')}
                    </th>
                    <th
                      scope="col"
                      className="py-1.5 pr-2 text-right font-semibold"
                    >
                      {t('result')}
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      {t('unit')}
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      {t('interval')}
                    </th>
                    <th scope="col" className="py-1.5 font-semibold">
                      {t('flag')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr
                      key={row.resultId}
                      className="border-b border-[#e3e8eb] align-top"
                    >
                      <th
                        scope="row"
                        className="py-1.5 pr-2 text-left font-normal"
                      >
                        {row.name}
                      </th>
                      <td
                        className={cn(
                          'py-1.5 pr-2 text-right tabular-nums',
                          isAbnormalFlag(row.flag) && 'font-bold',
                        )}
                      >
                        {text(row.value, row)}
                      </td>
                      <td className="py-1.5 pr-2 text-[#5b6670]">{row.unit}</td>
                      <td className="py-1.5 pr-2 text-[#5b6670] tabular-nums">
                        {interval(row)}
                      </td>
                      <td
                        className={cn(
                          'py-1.5 font-semibold',
                          row.flag?.startsWith('CRITICAL')
                            ? 'text-[#b91c1c]'
                            : 'text-[#92400e]',
                        )}
                      >
                        {flagLabel(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="mt-2 grid gap-2 sm:hidden">
                {section.rows.map((row) => (
                  <li
                    key={row.resultId}
                    className={cn(
                      'rounded-lg border px-3 py-2',
                      isAbnormalFlag(row.flag)
                        ? 'border-[#f59e0b]/50 bg-[#fffbeb]'
                        : 'border-[#e3e8eb]',
                    )}
                  >
                    <p className="flex items-baseline justify-between gap-3 text-[10pt]">
                      <span>{row.name}</span>
                      <span
                        className={cn(
                          'tabular-nums',
                          isAbnormalFlag(row.flag) && 'font-bold',
                        )}
                      >
                        {text(row.value, row)} {row.unit}
                      </span>
                    </p>
                    <p className="mt-0.5 flex justify-between gap-3 text-[8.5pt] text-[#5b6670]">
                      <span>
                        {t('interval')}: {interval(row) || '-'}
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          row.flag?.startsWith('CRITICAL')
                            ? 'text-[#b91c1c]'
                            : 'text-[#92400e]',
                        )}
                      >
                        {flagLabel(row) || t('normal')}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
              {section.comments.length ? (
                <p className="mt-1.5 text-[9pt] text-[#4a5560] italic">
                  {section.comments.join(' ')}
                </p>
              ) : null}
            </>
          )}
        </section>
      ))}
      {notAccredited ? (
        <p className="mt-3 text-[8pt] text-[#4a5560]">
          * {tr('notAccreditedFootnote')}
        </p>
      ) : null}

      {report.criticals.length ? (
        <p className="mt-5 flex items-start gap-2 rounded-md border border-[#b91c1c]/40 px-3 py-2 text-[9pt] text-[#141a1f]">
          <BellRingIcon
            className="mt-0.5 size-3.5 shrink-0 text-[#b91c1c]"
            aria-hidden
          />
          {t('criticalNote')}
        </p>
      ) : null}
      {report.interpretation ? (
        <section className="mt-5">
          <h3 className="text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
            {t('interpretation')}
          </h3>
          <p className="mt-1 text-[10pt]">{report.interpretation}</p>
        </section>
      ) : null}

      {lab?.patientSummaryOnReport && report.status !== 'withdrawn' ? (
        <PatientSummary
          report={report}
          langs={summaryLanguages(p.preferredLanguage, language)}
          className="mt-5"
        />
      ) : null}

      <footer className="mt-8 grid gap-4 border-t border-[#c9d2d8] pt-4 text-[9pt] sm:grid-cols-3">
        {report.reviewers.length ? (
          <Meta label={t('verifiedBy')}>
            {report.reviewers.map((r) => r.name).join(', ')}
          </Meta>
        ) : null}
        {report.authorisers.length ? (
          <Meta label={t('authorisedBy')}>
            {report.authorisers
              .map(
                (a) =>
                  `${a.name}${a.qualification ? `, ${a.qualification}` : ''}`,
              )
              .join('; ')}
          </Meta>
        ) : null}
        {report.pathologist ? (
          <Meta label={t('signedBy')}>
            <span className="inline-flex items-center gap-1 text-[#1d4ed8]">
              <BadgeCheckIcon className="size-3.5" aria-hidden />
              {tr('signature')}
            </span>
            <span className="block font-semibold">
              {report.pathologist.name}
            </span>
          </Meta>
        ) : null}
      </footer>
      {report.seal ? (
        <VerificationBlock
          seal={report.seal}
          scanLabel={t('scanToVerify')}
          digestLabel={t('digest')}
          className="mt-5"
        />
      ) : null}
      <p className="mt-5 text-[8pt] text-[#5b6670]">
        {lab?.reportFooter ?? t('disclaimer')}
      </p>
      <p className="mt-1 text-[8pt] font-semibold tracking-[0.2em] text-[#5b6670] uppercase">
        {tr('endOfReport')}
      </p>
    </article>
  )
}
