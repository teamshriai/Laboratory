import {
  DownloadIcon,
  InfoIcon,
  LockKeyholeIcon,
  PrinterIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useNow } from '@/hooks/use-now'
import { useLanguage, useT } from '@/i18n/context'
import { labApi, type PublicReport } from '@/services/lab-api'
import { errorMessage } from '@/services/mutations'
import { reportPdf } from '@/services/report-files'
import { ImagingDocument } from '@/components/lab/documents/imaging-document'
import { LabDocument } from '@/components/lab/documents/lab-document'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { usePrint, usePrintable } from '@/components/ui/print-context'
import { ReportSheet } from '@/features/reports/report-sheet'
import { PortalFrame } from './portal-frame'

/**
 * The patient-facing report behind a share link (/r/<token>): a document
 * portal, deliberately unlike the staff screens. It opens only after the
 * patient's date of birth; the link may have expired or been revoked, and
 * every attempt is logged on it. Demo: it reads this browser's data.
 */
export function Component() {
  const t = useT('portal')
  const { language } = useLanguage()
  const { token = '' } = useParams()
  const [dob, setDob] = useState('')
  const open = useMutation({
    mutationFn: (date: string) => labApi.portal.open(token, { dob: date }),
  })
  const data = open.data
  useDocumentTitle(data?.report.reportNo ?? t('dobTitle'))

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    if (dob) open.mutate(dob)
  }

  return (
    <PortalFrame
      actions={data ? <Toolbar data={data} /> : null}
      lab={data?.lab}
    >
      <p
        role="note"
        className="flex items-start gap-2 rounded-lg border border-info-text/25 bg-info-soft px-3.5 py-2.5 text-meta text-info-text print:hidden"
      >
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('demoBanner')}
      </p>
      {data ? (
        <>
          <h1 className="sr-only">
            {data.kind === 'laboratory'
              ? data.report.reportNo
              : data.report.examName}
          </h1>
          <p className="text-meta text-fg-muted print:hidden">
            {t('linkVersion', { version: data.report.version })}
          </p>
          {data.kind === 'laboratory' ? (
            <LabDocument report={data.report} lab={data.lab} />
          ) : (
            <ImagingDocument report={data.report} lab={data.lab} />
          )}
        </>
      ) : (
        <form
          onSubmit={submit}
          className="mx-auto grid w-full max-w-md gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <LockKeyholeIcon
              className="mt-0.5 size-5 shrink-0 text-accent-text"
              aria-hidden
            />
            <div>
              <h1 className="text-lg font-semibold text-fg">{t('dobTitle')}</h1>
              <p className="mt-1 text-meta text-fg-muted">{t('dobBody')}</p>
            </div>
          </div>
          <Field
            label={t('dobLabel')}
            error={
              open.isError ? errorMessage(open.error, language) : undefined
            }
          >
            <Input
              type="date"
              required
              autoComplete="bday"
              value={dob}
              onChange={(ev) => setDob(ev.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={open.isPending}
            disabled={!dob}
          >
            {t('openReport')}
          </Button>
        </form>
      )}
    </PortalFrame>
  )
}

function Toolbar({ data }: { data: PublicReport }) {
  const t = useT('portal')
  const { language } = useLanguage()
  const now = useNow()
  const { print } = usePrint()
  // What prints (and becomes the PDF): the A4 sheet for laboratory reports,
  // the document itself for imaging.
  const sheet =
    data.kind === 'laboratory' ? (
      <ReportSheet
        report={data.report}
        lang={language}
        now={now}
        lab={data.lab}
      />
    ) : (
      <ImagingDocument report={data.report} lab={data.lab} />
    )
  usePrintable(sheet)
  const download = async () => {
    const file = await reportPdf(data.report.reportNo ?? '')
    if (file) {
      window.location.assign(file.url)
      return
    }
    toast.info(t('pdfHint'))
    print(sheet)
  }
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Button
        variant="primary"
        className="flex-1 sm:flex-none"
        onClick={() => void download()}
      >
        <DownloadIcon />
        {t('downloadPdf')}
      </Button>
      <Button className="flex-1 sm:flex-none" onClick={() => print(sheet)}>
        <PrinterIcon />
        {t('print')}
      </Button>
    </div>
  )
}
