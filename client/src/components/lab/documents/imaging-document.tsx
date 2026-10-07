import { BadgeCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LabSettings } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { PublicImagingReport } from '@/services/lab-api'
import { IndostatesLogo, Logo } from '@/components/ui/logo'
import {
  cssString,
  pageOfContent,
  usePageRules,
} from '@/components/ui/page-margins'
import { INDOSTATES } from '@/lib/brand'
import { useAgeText } from '../patient'
import { VerificationBlock } from './report-blocks'

type Lab = Pick<
  LabSettings,
  'labName' | 'labAddress' | 'labRegistration' | 'labAccreditation'
>

const MARGIN_TEXT =
  "font: 7.5pt 'Plus Jakarta Sans Variable', sans-serif; color: #5b6670;"

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8pt] font-semibold tracking-[0.08em] text-[#5b6670] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[10pt] text-[#141a1f]">{children}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-avoid-break mt-6">
      <h3 className="border-b border-[#d7dee3] pb-1.5 text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
        {title}
      </h3>
      <div className="mt-2.5 text-[10pt] leading-relaxed text-[#1f262d]">
        {children}
      </div>
    </section>
  )
}

/**
 * An imaging report as a medical document (white paper, document type,
 * restrained colour): the same component on screen, in print and as the
 * PDF. Paper colours are fixed so a dark-theme session prints correctly.
 */
export function ImagingDocument({
  report,
  lab,
}: {
  report: PublicImagingReport
  lab?: Lab | undefined
}) {
  const t = useT('imaging')
  const tp = useT('portal')
  const tr = useT('reports')
  const e = useEnum()
  const f = useFormat()
  const age = useAgeText()
  const v = report.viewing
  const p = report.patient
  const kind = v ? t(`kind.${v.kind}`) : t('status.acquired')

  usePageRules(
    v
      ? [
          '@page {',
          `  @top-left { content: ${cssString(`${p.name} · ${tp('uhid')} ${p.uhid}`)}; ${MARGIN_TEXT} }`,
          `  @top-right { content: ${cssString(`${report.reportNo ?? report.accessionNo} · v${v.version} · ${kind}`)}; ${MARGIN_TEXT} }`,
          `  @bottom-left { content: ${cssString(`${t('studyDate')} ${f.dateTime(report.performedAt ?? report.scheduledAt)}`)}; ${MARGIN_TEXT} }`,
          `  @bottom-right { content: ${pageOfContent(tr('pageOf', { page: '{page}', pages: '{pages}' }))}; ${MARGIN_TEXT} }`,
          '}',
          '@page :first { @top-left { content: none } @top-right { content: none } }',
        ].join('\n')
      : null,
  )

  return (
    <article className="relative mx-auto w-full max-w-[210mm] bg-[#ffffff] px-5 py-6 text-[#141a1f] shadow-overlay sm:px-[14mm] sm:py-[12mm] print:shadow-none">
      {report.supersededBy ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
        >
          <span className="-rotate-30 text-[40pt] font-bold tracking-widest text-[#141a1f]/[0.05] uppercase">
            {t('superseded')}
          </span>
        </span>
      ) : null}
      <header className="flex flex-col gap-4 border-b-2 border-[#2563eb] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Logo className="size-11" />
          <div>
            <p className="text-[14pt] leading-tight font-bold text-[#1e3a8a]">
              {lab?.labName ?? 'SHRI HEALTH'}
            </p>
            <p className="mt-0.5 text-[9pt] text-[#4a5560]">
              {t('department')}
            </p>
            {lab?.labAddress ? (
              <p className="text-[8pt] text-[#5b6670]">{lab.labAddress}</p>
            ) : null}
            {lab?.labAccreditation || lab?.labRegistration ? (
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
          <p className="font-mono text-[10pt] font-bold text-[#141a1f]">
            {report.reportNo ?? report.accessionNo}
          </p>
          <p className="text-[8.5pt] text-[#4a5560]">
            {t(`modalityLong.${report.modality}`)}
          </p>
          <p
            className={cn(
              'text-[8pt] font-bold tracking-[0.12em] uppercase',
              v?.kind === 'amended' ? 'text-[#b45309]' : 'text-[#1e3a8a]',
            )}
          >
            {kind} · v{report.version || '-'}
          </p>
        </div>
      </header>

      <h2 className="mt-5 text-[15pt] leading-snug font-semibold text-[#141a1f]">
        {report.examName}
      </h2>

      {report.supersededBy ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-[#d7dee3] bg-[#f3f6f7] px-3 py-2 text-[9pt] text-[#2b343c]">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('supersededBanner', {
            version: report.version,
            latest: report.supersededBy,
          })}
        </p>
      ) : null}
      {v?.kind === 'amended' && v.amendmentReason ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-[#f59e0b]/60 bg-[#fffbeb] px-3 py-2 text-[9pt] font-medium text-[#92400e]">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('amendedBanner', { reason: v.amendmentReason })}
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-[#f3f6f7] px-4 py-3.5 sm:grid-cols-3">
        <Meta label={tp('patient')}>
          <strong>{p.name}</strong>
        </Meta>
        <Meta label={tp('uhid')}>
          <span className="font-mono">{p.uhid}</span>
        </Meta>
        <Meta label={tp('ageSex')}>
          {age(p.dob)} / {e('sexShort', p.sex)}
        </Meta>
        <Meta label={t('colDoctor')}>{report.doctor.name}</Meta>
        <Meta label={t('colAccession')}>
          <span className="font-mono">{report.accessionNo}</span>
        </Meta>
        <Meta label={t('studyDate')}>
          {f.dateTime(report.performedAt ?? report.scheduledAt)}
        </Meta>
      </dl>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 px-1 sm:grid-cols-2">
        <Meta label={t('examination')}>{report.examName}</Meta>
        <Meta label={t('bodyRegion')}>{report.bodyRegion}</Meta>
        <Meta label={t('indication')}>{report.indication}</Meta>
        {report.contrast ? (
          <Meta label={t('contrast')}>{report.contrast}</Meta>
        ) : null}
      </dl>

      {v ? (
        <>
          <Block title={t('technique')}>
            <p>{v.technique}</p>
            {v.comparison ? (
              <p className="mt-1.5 text-[#4a5560]">
                <span className="font-semibold">{t('comparison')}:</span>{' '}
                {v.comparison}
              </p>
            ) : null}
          </Block>
          <Block title={t('findings')}>
            <dl className="grid gap-3">
              {v.findings.map((finding) => (
                <div key={finding.heading} className="print-avoid-break">
                  <dt className="font-semibold text-[#141a1f]">
                    {finding.heading}
                  </dt>
                  <dd className="mt-0.5">{finding.text}</dd>
                </div>
              ))}
            </dl>
          </Block>
          <section className="print-avoid-break mt-6 rounded-lg border-l-4 border-[#1e3a8a] bg-[#f5f8ff] px-4 py-3">
            <h3 className="text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
              {t('impression')}
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[10.5pt] leading-relaxed font-medium text-[#141a1f]">
              {v.impression.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
          {v.recommendations?.length ? (
            <Block title={t('recommendations')}>
              <ul className="list-disc space-y-1 pl-5">
                {v.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Block>
          ) : null}

          <footer className="print-avoid-break mt-8 grid gap-5 border-t border-[#c9d2d8] pt-4 sm:grid-cols-2">
            <div>
              <p className="text-[8pt] font-semibold tracking-[0.08em] text-[#5b6670] uppercase">
                {t('reportedBy')}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[8pt] font-semibold text-[#1d4ed8]">
                <BadgeCheckIcon className="size-3.5" aria-hidden />
                {tr('signature')}
              </p>
              <p className="text-[10pt] font-semibold">{v.reportedBy.name}</p>
              <p className="text-[8.5pt] text-[#5b6670]">
                {v.reportedBy.qualification}
              </p>
              <p className="text-[8.5pt] text-[#5b6670]">
                {t('reportedDate')} {f.dateTime(v.releasedAt)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[8pt] font-semibold tracking-[0.08em] text-[#5b6670] uppercase">
                {t('verifiedBy')}
              </p>
              <p className="mt-1 text-[10pt] font-semibold">
                {v.verifiedBy.name}
              </p>
              <p className="text-[8.5pt] text-[#5b6670]">
                {v.verifiedBy.qualification}
              </p>
            </div>
          </footer>
          {report.seal ? (
            <VerificationBlock
              seal={report.seal}
              scanLabel={tp('scanToVerify')}
              digestLabel={tp('digest')}
              className="mt-5"
            />
          ) : null}
          <p className="mt-6 text-[8pt] text-[#5b6670]">{t('demoNote')}</p>
          <p className="mt-1 text-[8pt] font-semibold tracking-[0.2em] text-[#5b6670] uppercase">
            {t('endOfReport')}
          </p>
        </>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-[#c9d2d8] px-5 py-8 text-center">
          <p className="text-[11pt] font-semibold text-[#141a1f]">
            {t('notReported')}
          </p>
          <p className="mt-1 text-[9pt] text-[#5b6670]">
            {t('notReportedBody')}
          </p>
        </div>
      )}
    </article>
  )
}
