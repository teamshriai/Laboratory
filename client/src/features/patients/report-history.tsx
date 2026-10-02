import { ChevronRightIcon, FileTextIcon } from 'lucide-react'
import { Link } from 'react-router'
import type {
  DepartmentId,
  ImagingStatus,
  Modality,
  ReportStatus,
} from '@/domain/types'
import { MODALITIES } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { PatientReportEntry } from '@/services/lab-api'
import { ImagingStatusBadge } from '@/components/lab/imaging-status'
import { ReportStatusBadge } from '@/components/lab/status'
import { EmptyState } from '@/components/ui/states'

const isModality = (d: string): d is Modality =>
  (MODALITIES as readonly string[]).includes(d)

function Row({ entry }: { entry: PatientReportEntry }) {
  const f = useFormat()
  return (
    <li>
      <Link
        to={entry.href}
        className="focus-ring flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-meta font-medium text-fg">
            {entry.title}
          </span>
          <span className="block text-xs text-fg-subtle">
            <span className="font-mono">{entry.reportNo}</span> ·{' '}
            {f.date(entry.date)} · v{entry.version}
          </span>
        </span>
        {entry.kind === 'imaging' ? (
          <ImagingStatusBadge status={entry.status as ImagingStatus} />
        ) : (
          <ReportStatusBadge status={entry.status as ReportStatus} size="sm" />
        )}
        <ChevronRightIcon className="size-4 text-fg-subtle" aria-hidden />
      </Link>
    </li>
  )
}

/**
 * Every laboratory and imaging report for the patient, by discipline
 * (newest first): the history the patient and doctor portals will show.
 */
export function ReportHistory({
  entries,
  limit,
}: {
  entries: PatientReportEntry[]
  /** A short, ungrouped list (the overview card). */
  limit?: number
}) {
  const t = useT('patients')
  const ti = useT('imaging')
  const e = useEnum()
  if (entries.length === 0)
    return <EmptyState icon={<FileTextIcon />} compact title={t('noReports')} />
  if (limit)
    return (
      <ul className="divide-y divide-line">
        {entries.slice(0, limit).map((entry) => (
          <Row key={`${entry.kind}-${entry.id}`} entry={entry} />
        ))}
      </ul>
    )
  const label = (d: string) =>
    isModality(d) ? ti(`modality.${d}`) : e('department', d as DepartmentId)
  const groups = new Map<string, PatientReportEntry[]>()
  for (const entry of entries) {
    const key = entry.discipline
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return (
    <div className="divide-y divide-line">
      {[...groups].map(([discipline, list]) => (
        <section key={discipline} aria-label={label(discipline)}>
          <h3 className="bg-surface-2/60 px-5 py-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            {label(discipline)}
            <span className="ml-2 font-normal normal-case">{list.length}</span>
          </h3>
          <ul className="divide-y divide-line">
            {list.map((entry) => (
              <Row key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
