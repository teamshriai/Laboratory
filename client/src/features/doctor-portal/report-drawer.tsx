import { ExternalLinkIcon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '@/i18n/context'
import { useLabSettings, useReport } from '@/services/queries'
import { LabDocument } from '@/components/lab/documents/lab-document'
import { Button, buttonVariants } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'

/** A released report, read in place as the same document the patient sees. */
export function ReportDrawer({
  reportId,
  reportNo,
  onClose,
}: {
  reportId: string | null
  reportNo: string | undefined
  onClose: () => void
}) {
  const t = useT('doctorPortal')
  return (
    <Drawer
      open={Boolean(reportId)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="xl"
      title={reportNo ? t('reportTitle', { reportNo }) : t('colReport')}
    >
      {reportId ? <ReportBody id={reportId} /> : null}
    </Drawer>
  )
}

function ReportBody({ id }: { id: string }) {
  const t = useT('doctorPortal')
  const tc = useT('common')
  const { data, isPending, isError, refetch } = useReport(id)
  const { data: lab } = useLabSettings()
  if (isPending)
    return (
      <div role="status" aria-busy className="grid gap-4">
        <Skeleton className="h-6 w-56" />
        <SkeletonText lines={3} />
        <Skeleton className="h-48 w-full" />
        <SkeletonText lines={5} />
      </div>
    )
  if (isError || !data)
    // The report could not be read here: offer the report's own page.
    return (
      <div role="alert">
        <EmptyState
          compact
          icon={<TriangleAlertIcon />}
          tone="red"
          title={t('reportFailedTitle')}
          description={t('reportFailedBody')}
          action={
            <>
              <Button onClick={() => void refetch()}>
                <RotateCwIcon />
                {tc('retry')}
              </Button>
              <Link
                to={`/reports/${id}`}
                className={buttonVariants({ variant: 'secondary' })}
              >
                <ExternalLinkIcon />
                {t('openReportPage')}
              </Link>
            </>
          }
        />
      </div>
    )
  return <LabDocument report={data} lab={lab} />
}
