import { InfoIcon } from 'lucide-react'
import type { Language } from '@/domain/types'
import { cn } from '@/lib/cn'
import { groupDigest } from '@/lib/digest'
import { verifyUrl } from '@/lib/share-url'
import type { PublicLabReport, VersionSeal } from '@/services/lab-api'
import { QrCode } from '../qr-code'
import { summaryLines, useTranslateIn } from './report-extras'

/**
 * The end-of-report verification block: a QR code to the public
 * verification page and the version's SHA-256 report code. Paper colours
 * are fixed, as on the rest of the document.
 */
export function VerificationBlock({
  seal,
  scanLabel,
  digestLabel,
  className,
}: {
  seal: VersionSeal
  scanLabel: string
  digestLabel: string
  className?: string
}) {
  return (
    <section
      className={cn(
        'print-avoid-break flex items-center gap-4 rounded-lg border border-[#d7dee3] px-3 py-2.5',
        className,
      )}
    >
      <QrCode
        value={verifyUrl(seal.verifyToken)}
        size={84}
        label={scanLabel}
        className="shrink-0"
      />
      <div className="min-w-0">
        <p className="text-[9pt] font-semibold text-[#141a1f]">{scanLabel}</p>
        <p className="mt-1.5 text-[7.5pt] font-semibold tracking-[0.08em] text-[#5b6670] uppercase">
          {digestLabel}
        </p>
        <p className="mt-0.5 font-mono text-[7.5pt] leading-relaxed text-[#2b343c]">
          {groupDigest(seal.digest)}
        </p>
      </div>
    </section>
  )
}

/**
 * "Summary for the patient": results outside their reference interval in
 * plain words, in the patient's preferred language and English when they
 * differ. Never a diagnosis, and it says so.
 */
export function PatientSummary({
  report,
  langs,
  includeUnreleased = false,
  className,
}: {
  report: Pick<PublicLabReport, 'sections'>
  langs: Language[]
  /** A draft shows every entered result; an issued report only released ones. */
  includeUnreleased?: boolean
  className?: string
}) {
  const tr = useTranslateIn(langs)
  const lines = summaryLines(report, includeUnreleased)
  return (
    <section
      className={cn(
        'print-avoid-break grid gap-3 rounded-lg border border-[#c9d2d8] bg-[#f8fafb] px-4 py-3',
        langs.length > 1 && 'sm:grid-cols-2 print:grid-cols-2',
        className,
      )}
    >
      {langs.map((lang) => {
        const t = (key: string, params?: Record<string, string | number>) =>
          tr(lang, 'reports', key, params)
        return (
          <div key={lang} lang={lang} className="min-w-0">
            <h3 className="text-[8.5pt] font-bold tracking-[0.12em] text-[#1e3a8a] uppercase">
              {t('patientSummaryTitle')}
            </h3>
            {lines.length ? (
              <>
                <p className="mt-1 text-[8.5pt] text-[#4a5560]">
                  {t('patientSummaryIntro')}
                </p>
                <ul className="mt-1 grid list-disc gap-0.5 pl-4 text-[9pt] text-[#141a1f]">
                  {lines.map((line) => (
                    <li key={line.id}>
                      {t('patientSummaryRow', {
                        test: line.test,
                        value: line.value(lang),
                        meaning: t(line.meaningKey),
                      })}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-[9pt] text-[#141a1f]">
                {t('patientSummaryNone')}
              </p>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-[8.5pt] font-semibold text-[#2b343c]">
              <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
              {t('patientSummaryDisclaimer')}
            </p>
          </div>
        )
      })}
    </section>
  )
}
