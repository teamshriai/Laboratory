import { TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PatientSummary } from '@/services/lab-api'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { AgeSex } from './patient'
import { RecordLink } from './record-link'

/**
 * The patient's identity on every patient-scoped screen (audit §16, D11):
 * name, UHID, age and sex, date of birth and location, from the patient
 * record itself. It stays in view while the page scrolls on wider screens,
 * so the patient being worked on is never in doubt.
 */
export function PatientBanner({
  patient,
  location,
  extra,
  className,
  sticky = true,
}: {
  patient: Pick<
    PatientSummary,
    'id' | 'name' | 'uhid' | 'dob' | 'sex' | 'nameLocal' | 'allergies'
  > & { encounter?: PatientSummary['encounter'] }
  /** Ward, bed or clinic, when the page knows it better than the patient. */
  location?: ReactNode
  /** Record details for the right-hand side (accession, priority…). */
  extra?: ReactNode
  className?: string
  sticky?: boolean
}) {
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const encounter = patient.encounter
  const where =
    location ??
    (encounter
      ? `${e('encounter', encounter.type)}${
          encounter.ward
            ? ` · ${encounter.bed ? tc('wardBed', { ward: encounter.ward, bed: encounter.bed }) : encounter.ward}`
            : ''
        }`
      : null)
  return (
    <section
      aria-label={tc('patientIdentity')}
      className={cn(
        'z-20 mb-5 rounded-xl border border-border bg-surface-2/95 px-4 py-3 backdrop-blur sm:px-5',
        sticky && 'md:sticky md:top-[calc(var(--header-h,4rem)+0.5rem)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-base font-semibold text-fg">
          <RecordLink kind="patient" id={patient.id} mono={false}>
            {patient.name}
          </RecordLink>
          {patient.nameLocal ? (
            <span
              lang={patient.nameLocal.lang}
              className="text-sm font-normal text-fg-muted"
            >
              {patient.nameLocal.text}
            </span>
          ) : null}
        </p>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-fg-muted">
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only sm:not-sr-only">{tc('uhid')}</dt>
            <dd>
              <RecordLink kind="patient" id={patient.id} className="text-fg">
                {patient.uhid}
              </RecordLink>
            </dd>
          </div>
          <div>
            <dt className="sr-only">{tc('ageSex')}</dt>
            <dd>
              <AgeSex dob={patient.dob} sex={patient.sex} />
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>{tc('dob')}</dt>
            <dd className="text-fg tabular-nums">
              {f.date(Date.parse(patient.dob))}
            </dd>
          </div>
          {where ? (
            <div>
              <dt className="sr-only">{tc('location')}</dt>
              <dd>{where}</dd>
            </div>
          ) : null}
        </dl>
        {patient.allergies.length ? (
          <p className="inline-flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-text">
            <TriangleAlertIcon className="size-3.5" aria-hidden />
            {tc('allergies')}: {patient.allergies.join(', ')}
          </p>
        ) : null}
        {extra ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta md:ml-auto">
            {extra}
          </div>
        ) : null}
      </div>
    </section>
  )
}
