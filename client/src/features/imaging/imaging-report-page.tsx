import {
  DownloadIcon,
  HistoryIcon,
  PrinterIcon,
  ScanLineIcon,
  Share2Icon,
  UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/app/layout/page-header'
import { useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi } from '@/services/lab-api'
import { useImagingReport, useLabSettings } from '@/services/queries'
import { reportPdf } from '@/services/report-files'
import { ImagingDocument } from '@/components/lab/documents/imaging-document'
import { ImagingStatusBadge } from '@/components/lab/imaging-status'
import { PatientBanner } from '@/components/lab/patient-banner'
import { ShareLinkPanel } from '@/components/lab/share-link-panel'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { usePrint, usePrintable } from '@/components/ui/print-context'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { focusWhenScrollable } from '@/lib/scroll-focus'
import { MODALITY_NAV, MODALITY_PATH } from './modality'

/** An imaging report as a document, with print, PDF, share and versions. */
export function Component() {
  const t = useT('imaging')
  const tn = useT('nav')
  const tp = useT('portal')
  const tc = useT('common')
  const f = useFormat()
  const { studyId } = useParams()
  const [versionParam, setVersionParam] = useSearchParam<string>('version', '')
  const version = Number(versionParam) || undefined
  const {
    data: report,
    isPending,
    isError,
    error,
    refetch,
  } = useImagingReport(studyId, version)
  const { data: lab } = useLabSettings()
  const { print } = usePrint()
  const [sharing, setSharing] = useState(false)

  const sheet = report ? <ImagingDocument report={report} lab={lab} /> : null
  usePrintable(sheet)

  if (isPending)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
          <Skeleton className="h-[40rem] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  if (isError || !report)
    return (error as { code?: string } | null)?.code === 'not-found' ? (
      <EmptyState icon={<ScanLineIcon />} title={t('notFound')} />
    ) : (
      <ErrorState onRetry={() => void refetch()} />
    )

  const download = async () => {
    // A server-made PDF when the backend provides one; the print dialog's
    // "Save as PDF" until then.
    const file = await reportPdf(report.reportNo ?? report.accessionNo)
    if (file) {
      window.location.assign(file.url)
      return
    }
    toast.info(tp('pdfHint'))
    if (sheet) print(sheet)
  }

  return (
    <>
      <PageHeader
        back={{
          to: MODALITY_PATH[report.modality],
          label: t('back', { modality: tn(MODALITY_NAV[report.modality]) }),
        }}
        title={report.examName}
        titleExtra={<ImagingStatusBadge status={report.status} size="md" />}
        meta={
          <span className="font-mono">
            {report.reportNo ?? report.accessionNo}
          </span>
        }
      />
      <PatientBanner
        patient={report.patient}
        extra={
          <span className="text-fg-muted">
            {tc('doctor')}:{' '}
            <span className="text-fg">{report.doctor.name}</span>
          </span>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          ref={focusWhenScrollable}
          className="focus-ring overflow-x-auto rounded-xl bg-surface-3/70 p-2 sm:p-8"
        >
          {sheet}
        </div>
        <div className="grid content-start gap-4 xl:sticky xl:top-[calc(var(--header-h,4rem)+1rem)]">
          <Card className="grid gap-2 p-4">
            <Button
              variant="primary"
              disabled={!report.viewing}
              onClick={() => void download()}
            >
              <DownloadIcon />
              {tp('downloadPdf')}
            </Button>
            <Button
              disabled={!report.viewing}
              onClick={() => sheet && print(sheet)}
            >
              <PrinterIcon />
              {tp('print')}
            </Button>
            <Button
              disabled={!report.viewing || Boolean(report.supersededBy)}
              onClick={() => setSharing(true)}
            >
              <Share2Icon />
              {tp('share')}
            </Button>
            <Link
              to={`/patients/${report.patient.id}`}
              className={buttonVariants({ variant: 'ghost' })}
            >
              <UserIcon />
              {t('backToPatient')}
            </Link>
          </Card>
          {report.versions.length ? (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                <HistoryIcon className="size-4 text-fg-subtle" aria-hidden />
                {t('versions')}
              </h2>
              <ol className="grid gap-1">
                {report.versions.toReversed().map((v, i) => {
                  const viewing = v.version === report.version
                  return (
                    <li key={v.version}>
                      <button
                        type="button"
                        aria-current={viewing || undefined}
                        onClick={() =>
                          setVersionParam(i === 0 ? null : String(v.version))
                        }
                        className={cn(
                          'focus-ring w-full rounded-lg px-3 py-2 text-left transition-colors',
                          viewing
                            ? 'bg-accent-soft text-accent-text'
                            : 'hover:bg-surface-2',
                        )}
                      >
                        <span className="block text-meta font-medium">
                          {t('versionRow', {
                            version: v.version,
                            kind: t(`kind.${v.kind}`),
                            time: f.dateTime(v.releasedAt),
                          })}
                          {i === 0 ? ` · ${t('current')}` : ''}
                        </span>
                        <span className="block text-xs text-fg-subtle">
                          {v.reportedBy}
                        </span>
                        {v.amendmentReason ? (
                          <span className="mt-0.5 block text-xs text-warning-text">
                            {v.amendmentReason}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ol>
              {report.supersededBy ? (
                <button
                  type="button"
                  onClick={() => setVersionParam(null)}
                  className="mt-2 inline-flex min-h-11 items-center text-meta font-semibold text-accent-text hover:underline"
                >
                  {t('viewCurrent')}
                </button>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
      {report.reportNo ? (
        <Dialog
          open={sharing}
          onOpenChange={setSharing}
          size="sm"
          title={tp('shareTitle', { report: report.reportNo })}
        >
          <ShareLinkPanel
            reportNo={report.reportNo}
            link={report.shareLink}
            create={() => labApi.imaging.shareLink(report.id)}
          />
        </Dialog>
      ) : null}
    </>
  )
}
