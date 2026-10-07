import {
  BookMarkedIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  FlaskConicalIcon,
  PrinterIcon,
  ShieldCheckIcon,
  SyringeIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { AuditEntity, QcResult } from '@/domain/types'
import { useActor } from '@/hooks/use-permission'
import { useNow } from '@/hooks/use-now'
import { useTablePaging } from '@/hooks/use-table-paging'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { IconTone } from '@/lib/icon-tones'
import { cn } from '@/lib/cn'
import {
  labApi,
  type CollectionRegisterRow,
  type DailyResultRow,
  type FormIIIRow,
  type IqcRegisterRow,
  type PageInfo,
} from '@/services/lab-api'
import { errorMessage } from '@/services/mutations'
import {
  useCollectionRegister,
  useDailyRegister,
  useFormIII,
  useIqcRegister,
  useLabSettings,
} from '@/services/queries'
import { ExportButton } from '@/components/lab/export-button'
import { RecordLink } from '@/components/lab/record-link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import {
  DataTable,
  type Column,
  type MobileLayout,
} from '@/components/ui/data-table'
import { usePrint } from '@/components/ui/print-context'
import { EmptyState } from '@/components/ui/states'
import { RegisterDocument } from './register-document'
import {
  collectionTable,
  dailyTable,
  formIIITable,
  iqcTable,
  locationText,
  type RegisterTable,
  type TableText,
} from './registers'

const PAGE_SIZE = 50

export interface Period {
  /** YYYY-MM or YYYY-MM-DD, as the API takes it. */
  value: string
  /** The period in words, for headings and the printout. */
  label: string
  /** The month or day control. */
  picker: ReactNode
}

function useTableText(): TableText {
  const t = useT('registers')
  const e = useEnum()
  const f = useFormat()
  return { t, e, f }
}

/**
 * One register: its heading and notes, the period, CSV export and the
 * printout of the whole period, and the server-paged table.
 */
function RegisterCard<T>({
  title,
  description,
  notes = [],
  icon,
  tone,
  file,
  entity,
  period,
  columns,
  rows,
  page,
  isPending,
  isError,
  onRetry,
  getRowId,
  mobile,
  rowClassName,
  fetchAll,
  toTable,
  pageNo,
}: {
  title: string
  description: string
  notes?: string[]
  icon: ReactNode
  tone: IconTone
  /** File name and audit record for exports and prints. */
  file: string
  entity: AuditEntity
  period: Period
  columns: Column<T>[]
  rows: T[] | undefined
  page: PageInfo | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  getRowId: (row: T) => string
  mobile: MobileLayout
  rowClassName?: (row: T) => string | undefined
  /** Every entry of the period (no page size). */
  fetchAll: () => Promise<T[]>
  toTable: (rows: T[]) => RegisterTable
  pageNo: ReturnType<typeof useTablePaging>
}) {
  const t = useT('registers')
  const te = useT('errors')
  const { language } = useLanguage()
  const { print } = usePrint()
  const { data: settings } = useLabSettings()
  const actor = useActor()
  const now = useNow()
  const [printing, setPrinting] = useState(false)
  const name = `${file}-${period.value}`

  const printAll = async () => {
    if (!settings) return
    setPrinting(true)
    try {
      const all = await fetchAll()
      // Recorded first: a printout that cannot be audited is not made.
      await labApi.admin.recordAccess({
        kind: 'printed',
        entity,
        id: name,
        count: all.length,
      })
      print(
        <RegisterDocument
          lab={settings}
          title={title}
          period={period.label}
          notes={notes}
          table={toTable(all)}
          printedAt={now}
          printedBy={actor?.name ?? ''}
        />,
      )
    } catch (error) {
      toast.error(te('genericTitle'), {
        description: errorMessage(error, language),
      })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={title}
        description={description}
        icon={icon}
        tone={tone}
        action={period.picker}
      />
      {notes.length ? (
        <div className="grid gap-1 px-4 pb-3 sm:px-5">
          {notes.map((n) => (
            <p key={n} className="max-w-4xl text-meta text-fg-muted">
              {n}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 sm:px-5">
        <p className="text-meta text-fg-muted" aria-live="polite">
          {page
            ? t('entriesFor', { count: page.total, period: period.label })
            : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            filename={name}
            entity={entity}
            disabled={!page?.total}
            rows={async () => {
              const table = toTable(await fetchAll())
              return [table.headers, ...table.rows]
            }}
          />
          <Button
            onClick={() => void printAll()}
            loading={printing}
            disabled={!settings || isPending || isError}
          >
            <PrinterIcon />
            {t('print')}
          </Button>
        </div>
      </div>
      <div className="border-t border-line">
        <DataTable
          caption={`${title} · ${period.label}`}
          columns={columns}
          rows={rows}
          server={pageNo.table(page)}
          getRowId={getRowId}
          isLoading={isPending}
          isError={isError}
          onRetry={onRetry}
          mobile={mobile}
          {...(rowClassName ? { rowClassName } : {})}
          empty={
            <EmptyState
              compact
              icon={icon}
              tone={tone}
              title={t('emptyTitle')}
              description={t('emptyBody', { period: period.label })}
            />
          }
        />
      </div>
    </Card>
  )
}

function PatientName({ id, name }: { id: string; name: string }) {
  return (
    <RecordLink
      kind="patient"
      id={id}
      mono={false}
      className="text-meta font-medium text-fg"
    >
      {name}
    </RecordLink>
  )
}

function LabNo({ value, sampleId }: { value: string; sampleId?: string }) {
  if (sampleId)
    return (
      <RecordLink kind="specimen" id={sampleId}>
        {value}
      </RecordLink>
    )
  return (
    <span className="font-mono text-meta whitespace-nowrap text-fg tabular-nums">
      {value}
    </span>
  )
}

function ResultText({ value }: { value: string }) {
  return (
    <span className="line-clamp-2 max-w-64 text-meta break-words text-fg 2xl:max-w-96">
      {value || '-'}
    </span>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <span className="block max-w-48 text-meta break-words text-fg-muted">
      {children || '-'}
    </span>
  )
}

// ---------- Form III ----------

export function FormIIIPanel({ period }: { period: Period }) {
  const t = useT('registers')
  const e = useEnum()
  const f = useFormat()
  const text = useTableText()
  const paging = useTablePaging(PAGE_SIZE, [])
  const { data, isPending, isError, refetch } = useFormIII(
    period.value,
    paging.query,
  )
  const columns: Column<FormIIIRow>[] = [
    {
      id: 'serial',
      header: t('colSerial'),
      align: 'right',
      cell: (r) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {r.serialNo}
        </span>
      ),
    },
    {
      id: 'date',
      header: t('colDate'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.date(r.date)}
        </span>
      ),
    },
    {
      id: 'labNo',
      header: t('colLabNo'),
      cell: (r) => <LabNo value={r.labNo} sampleId={r.sampleId} />,
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (r) => (
        <div className="grid max-w-56 min-w-0 gap-0.5">
          <PatientName id={r.patientId} name={r.patientName} />
          <span className="text-xs text-fg-muted">
            {t('ageSex', { age: Math.floor(r.age), sex: e('sexShort', r.sex) })}
          </span>
        </div>
      ),
    },
    {
      id: 'address',
      header: t('colAddress'),
      tabletHidden: true,
      cell: (r) => <Muted>{r.address}</Muted>,
    },
    {
      id: 'referredBy',
      header: t('colReferredBy'),
      tabletHidden: true,
      cell: (r) => <Muted>{r.referredBy}</Muted>,
    },
    {
      id: 'diagnosis',
      header: t('colDiagnosis'),
      tabletHidden: true,
      cell: (r) => <Muted>{r.provisionalDiagnosis}</Muted>,
    },
    {
      id: 'investigation',
      header: t('colInvestigation'),
      cell: (r) => (
        <div className="grid max-w-56 min-w-0 gap-0.5">
          {r.reportId ? (
            <RecordLink
              kind="report"
              id={r.reportId}
              mono={false}
              className="text-meta font-medium text-fg"
            >
              {r.investigation}
            </RecordLink>
          ) : (
            <span className="text-meta font-medium text-fg">
              {r.investigation}
            </span>
          )}
          <span className="text-xs text-fg-muted">
            {e('specimen', r.specimen)}
          </span>
        </div>
      ),
    },
    {
      id: 'method',
      header: t('colMethod'),
      tabletHidden: true,
      cell: (r) => <Muted>{r.methodEquipment}</Muted>,
    },
    {
      id: 'result',
      header: t('colResult'),
      cell: (r) => <ResultText value={r.result} />,
    },
    {
      id: 'initials',
      header: t('colInitialsShort'),
      cell: (r) => (
        <span
          className="font-mono text-meta font-semibold text-fg"
          title={t('colInitials')}
        >
          {r.initials || '-'}
        </span>
      ),
    },
  ]
  return (
    <RegisterCard
      title={t('formIiiTitle')}
      description={t('formIiiDescription')}
      notes={[t('formIiiRule'), t('formIiiWording')]}
      icon={<BookMarkedIcon />}
      tone="indigo"
      file="form-iii"
      entity="patient"
      period={period}
      columns={columns}
      rows={data?.rows}
      page={data?.page}
      isPending={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      getRowId={(r) => `${r.serialNo}-${r.labNo}-${r.investigation}`}
      mobile={{
        primary: 'patient',
        fields: ['date', 'labNo', 'investigation', 'result'],
      }}
      fetchAll={async () => (await labApi.registers.formIII(period.value)).rows}
      toTable={(rows) => formIIITable(rows, text)}
      pageNo={paging}
    />
  )
}

// ---------- Daily results ----------

export function DailyPanel({ period }: { period: Period }) {
  const t = useT('registers')
  const f = useFormat()
  const text = useTableText()
  const paging = useTablePaging(PAGE_SIZE, [])
  const { data, isPending, isError, refetch } = useDailyRegister(
    period.value,
    paging.query,
  )
  const columns: Column<DailyResultRow>[] = [
    {
      id: 'time',
      header: t('colTime'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.time(r.at)}
        </span>
      ),
    },
    {
      id: 'labNo',
      header: t('colLabNo'),
      cell: (r) => <LabNo value={r.labNo} sampleId={r.sampleId} />,
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (r) => <PatientName id={r.patientId} name={r.patientName} />,
    },
    {
      id: 'investigation',
      header: t('colInvestigation'),
      cell: (r) => (
        <span className="block max-w-56 text-meta font-medium text-fg">
          {r.investigation}
        </span>
      ),
    },
    {
      id: 'result',
      header: t('colResult'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <ResultText value={r.result} />
          {r.abnormal ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text">
              <TriangleAlertIcon className="size-3.5" aria-hidden />
              {t('abnormal')}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'authorisedBy',
      header: t('colAuthorisedBy'),
      cell: (r) => <Muted>{r.authorisedBy}</Muted>,
    },
  ]
  return (
    <RegisterCard
      title={t('dailyTitle')}
      description={t('dailyDescription')}
      icon={<ShieldCheckIcon />}
      tone="green"
      file="daily-results"
      entity="patient"
      period={period}
      columns={columns}
      rows={data?.rows}
      page={data?.page}
      isPending={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      getRowId={(r) => `${r.at}-${r.labNo}-${r.investigation}`}
      mobile={{
        primary: 'patient',
        fields: ['time', 'labNo', 'investigation', 'result'],
      }}
      fetchAll={async () => (await labApi.registers.daily(period.value)).rows}
      toTable={(rows) => dailyTable(rows, text)}
      pageNo={paging}
    />
  )
}

// ---------- Internal quality control ----------

const QC_ICON: Record<QcResult, ReactNode> = {
  pass: <CircleCheckIcon className="size-3.5" aria-hidden />,
  warning: <CircleAlertIcon className="size-3.5" aria-hidden />,
  fail: <CircleXIcon className="size-3.5" aria-hidden />,
}
const QC_TEXT: Record<QcResult, string> = {
  pass: 'text-success-text',
  warning: 'text-warning-text',
  fail: 'text-danger-text',
}

export function IqcPanel({ period }: { period: Period }) {
  const t = useT('registers')
  const e = useEnum()
  const f = useFormat()
  const text = useTableText()
  const paging = useTablePaging(PAGE_SIZE, [])
  const { data, isPending, isError, refetch } = useIqcRegister(
    period.value,
    paging.query,
  )
  const columns: Column<IqcRegisterRow>[] = [
    {
      id: 'time',
      header: t('colDateTime'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.dateTime(r.at)}
        </span>
      ),
    },
    {
      id: 'equipment',
      header: t('colEquipment'),
      cell: (r) => <Muted>{r.equipmentName}</Muted>,
    },
    {
      id: 'analyte',
      header: t('colAnalyte'),
      cell: (r) => (
        <div className="grid min-w-0 gap-0.5">
          <span className="text-meta font-medium text-fg">{r.analyteName}</span>
          <span className="text-xs text-fg-muted">
            {t('levelValue', { level: r.level })}
          </span>
        </div>
      ),
    },
    {
      id: 'lot',
      header: t('colLot'),
      tabletHidden: true,
      cell: (r) => (
        <span className="font-mono text-xs text-fg-muted">{r.controlLot}</span>
      ),
    },
    {
      id: 'value',
      header: t('colValue'),
      align: 'right',
      cell: (r) => (
        <div className="grid justify-items-end gap-0.5">
          <span className="text-meta font-medium text-fg tabular-nums">
            {f.number(r.value)}
          </span>
          <span className="text-xs whitespace-nowrap text-fg-muted tabular-nums">
            {t('meanSd', { mean: f.number(r.mean), sd: f.number(r.sd) })}
          </span>
        </div>
      ),
    },
    {
      id: 'outcome',
      header: t('colOutcome'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap',
              QC_TEXT[r.result],
            )}
          >
            {QC_ICON[r.result]}
            {e('qcResult', r.result)}
          </span>
          {r.rule ? (
            <span className="font-mono text-xs text-fg-muted">{r.rule}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'by',
      header: t('colRunBy'),
      tabletHidden: true,
      cell: (r) => <Muted>{r.byName}</Muted>,
    },
    {
      id: 'action',
      header: t('colAction'),
      cell: (r) => <Muted>{r.correctiveAction}</Muted>,
    },
  ]
  return (
    <RegisterCard
      title={t('iqcTitle')}
      description={t('iqcDescription')}
      icon={<FlaskConicalIcon />}
      tone="teal"
      file="iqc-register"
      entity="qc"
      period={period}
      columns={columns}
      rows={data?.rows}
      page={data?.page}
      isPending={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      getRowId={(r) => `${r.at}-${r.equipmentName}-${r.analyteName}-${r.level}`}
      rowClassName={(r) => (r.result === 'fail' ? 'row-alert' : undefined)}
      mobile={{
        primary: 'analyte',
        fields: ['time', 'equipment', 'value', 'outcome'],
      }}
      fetchAll={async () => (await labApi.registers.iqc(period.value)).rows}
      toTable={(rows) => iqcTable(rows, text)}
      pageNo={paging}
    />
  )
}

// ---------- Specimen collection ----------

export function CollectionPanel({ period }: { period: Period }) {
  const t = useT('registers')
  const e = useEnum()
  const f = useFormat()
  const text = useTableText()
  const paging = useTablePaging(PAGE_SIZE, [])
  const { data, isPending, isError, refetch } = useCollectionRegister(
    period.value,
    paging.query,
  )
  const columns: Column<CollectionRegisterRow>[] = [
    {
      id: 'time',
      header: t('colTime'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.time(r.at)}
        </span>
      ),
    },
    {
      id: 'labNo',
      header: t('colLabNo'),
      cell: (r) => <LabNo value={r.labNo} sampleId={r.sampleId} />,
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (r) => <PatientName id={r.patientId} name={r.patientName} />,
    },
    {
      id: 'specimen',
      header: t('colSpecimen'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta text-fg">{e('specimen', r.specimen)}</span>
          <span className="text-xs text-fg-muted">
            {e('container', r.container)}
          </span>
        </div>
      ),
    },
    {
      id: 'collectedBy',
      header: t('colCollectedBy'),
      cell: (r) => <Muted>{r.collectedBy}</Muted>,
    },
    {
      id: 'location',
      header: t('colLocation'),
      cell: (r) => <Muted>{locationText(r.location, e)}</Muted>,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) =>
        r.rejected ? (
          <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-danger-text">
            <CircleXIcon className="size-3.5" aria-hidden />
            {t('rejected')}
          </span>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
  ]
  return (
    <RegisterCard
      title={t('collectionTitle')}
      description={t('collectionDescription')}
      icon={<SyringeIcon />}
      tone="rose"
      file="collection-register"
      entity="sample"
      period={period}
      columns={columns}
      rows={data?.rows}
      page={data?.page}
      isPending={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      getRowId={(r) => `${r.at}-${r.labNo}`}
      mobile={{
        primary: 'patient',
        fields: ['time', 'labNo', 'specimen', 'status'],
      }}
      fetchAll={async () =>
        (await labApi.registers.collection(period.value)).rows
      }
      toTable={(rows) => collectionTable(rows, text)}
      pageNo={paging}
    />
  )
}
