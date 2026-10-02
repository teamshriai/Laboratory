import {
  DownloadIcon,
  FileSearchIcon,
  InfoIcon,
  PrinterIcon,
} from 'lucide-react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useNow } from '@/hooks/use-now'
import { useSearchParam } from '@/hooks/use-search-param'
import { useLanguage, useT } from '@/i18n/context'
import { INDOSTATES } from '@/lib/brand'
import { useLabSettings, usePortalReport } from '@/services/queries'
import { reportPdf } from '@/services/report-files'
import { ImagingDocument } from '@/components/lab/documents/imaging-document'
import { LabDocument } from '@/components/lab/documents/lab-document'
import { Button } from '@/components/ui/button'
import { IndostatesLogo, Logo } from '@/components/ui/logo'
import { usePrint, usePrintable } from '@/components/ui/print-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Segmented } from '@/components/ui/toggles'
import { ReportSheet } from '@/features/reports/report-sheet'

/**
 * The patient-facing report page behind a share link: a document portal,
 * deliberately unlike the staff screens (no sidebar, no workflow). Demo: it
 * reads this browser's data; the backend will serve it behind access
 * control, and later the patient and doctor portals list the same reports.
 */
export function Component() {
  const t = useT('portal')
  const { language } = useLanguage()
  const now = useNow()
  const { reportNo } = useParams()
  const [versionParam, setVersionParam] = useSearchParam<string>('version', '')
  const version = Number(versionParam) || undefined
  const { data, isPending, isError } = usePortalReport(reportNo, version)
  const { data: lab } = useLabSettings()
  const { print } = usePrint()
  useDocumentTitle(reportNo)

  // What prints (and becomes the PDF): the A4 sheet for laboratory reports,
  // the document itself for imaging.
  const sheet = !data ? null : data.kind === 'laboratory' ? (
    <ReportSheet report={data.report} lang={language} now={now} lab={lab} />
  ) : (
    <ImagingDocument report={data.report} lab={lab} />
  )
  usePrintable(sheet)

  const latest = !data ? 0 : (data.report.supersededBy ?? data.report.version)
  const download = async () => {
    const file = await reportPdf(reportNo ?? '')
    if (file) {
      window.location.assign(file.url)
      return
    }
    toast.info(t('pdfHint'))
    if (sheet) print(sheet)
  }

  return (
    <div className="min-h-dvh bg-surface-2 text-fg">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide text-fg">
                {lab?.labName ?? 'SHRI HEALTH'}
              </p>
              <p className="truncate text-xs text-fg-muted">{t('brandLine')}</p>
            </div>
          </div>
          <IndostatesLogo
            alt={INDOSTATES.name}
            className="hidden h-8 rounded-md sm:block"
          />
          {data ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="primary"
                className="flex-1 sm:flex-none"
                onClick={() => void download()}
              >
                <DownloadIcon />
                {t('downloadPdf')}
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => sheet && print(sheet)}
              >
                <PrinterIcon />
                {t('print')}
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-3 py-5 sm:px-6 sm:py-8">
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-info-text/25 bg-info-soft px-3.5 py-2.5 text-meta text-info-text print:hidden"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('demoBanner')}
        </p>

        {isPending ? (
          <Skeleton className="mx-auto h-[60rem] w-full max-w-[210mm] rounded-none" />
        ) : isError || !data ? (
          <section className="mx-auto grid w-full max-w-xl justify-items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center">
            <FileSearchIcon className="size-10 text-fg-subtle" aria-hidden />
            <h1 className="text-lg font-semibold text-fg">
              {t('notFoundTitle')}
            </h1>
            <p className="text-meta text-fg-muted">{t('notFoundBody')}</p>
          </section>
        ) : (
          <>
            <h1 className="sr-only">
              {data.kind === 'laboratory'
                ? data.report.reportNo
                : data.report.examName}
            </h1>
            {latest > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <p className="text-meta text-fg-muted">
                  {t('versionOf', { version: data.report.version, latest })}
                </p>
                <Segmented
                  size="sm"
                  aria-label={t('version', { version: data.report.version })}
                  value={String(data.report.version)}
                  onValueChange={(v) =>
                    setVersionParam(Number(v) === latest ? null : v)
                  }
                  options={Array.from({ length: latest }, (_, i) => ({
                    value: String(i + 1),
                    label: `v${i + 1}`,
                  }))}
                />
              </div>
            ) : null}
            {data.kind === 'laboratory' ? (
              <LabDocument report={data.report} lab={lab} />
            ) : (
              <ImagingDocument report={data.report} lab={lab} />
            )}
          </>
        )}
        <p className="text-center text-xs text-fg-subtle print:hidden">
          {t('disclaimer')}
        </p>
      </main>
    </div>
  )
}
