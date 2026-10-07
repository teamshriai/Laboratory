import {
  BadgeCheckIcon,
  CircleMinusIcon,
  CircleOffIcon,
  ClockAlertIcon,
  SignatureIcon,
} from 'lucide-react'
import { useState } from 'react'
import { DEPARTMENTS, type DepartmentId, type Staff } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { fromDateInput, toDateInput } from '@/lib/date-input'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useReference } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { Checkbox, Switch } from '@/components/ui/toggles'

/** Only these roles may authorise, so only they can be registered. */
const SIGNING_ROLES = new Set<Staff['role']>(['pathologist', 'microbiologist'])

type SignatoryState = 'active' | 'inactive' | 'expired' | 'none'

function stateOf(s: Staff, now: number): SignatoryState {
  const reg = s.signatory
  if (!reg) return 'none'
  if (!reg.active) return 'inactive'
  if (reg.validUntil !== undefined && reg.validUntil < now) return 'expired'
  return 'active'
}

function SignatoryStatus({ state }: { state: SignatoryState }) {
  const t = useT('admin')
  if (state === 'active')
    return (
      <Badge tone="success">
        <BadgeCheckIcon aria-hidden />
        {t('signatoryActive')}
      </Badge>
    )
  if (state === 'expired')
    return (
      <Badge tone="warning">
        <ClockAlertIcon aria-hidden />
        {t('signatoryExpired')}
      </Badge>
    )
  if (state === 'inactive')
    return (
      <Badge tone="neutral">
        <CircleOffIcon aria-hidden />
        {t('signatoryInactive')}
      </Badge>
    )
  return (
    <Badge tone="outline">
      <CircleMinusIcon aria-hidden />
      {t('signatoryNotRegistered')}
    </Badge>
  )
}

function SignatoryDialog({
  person,
  onClose,
}: {
  person: Staff
  onClose: () => void
}) {
  const t = useT('admin')
  const tc = useT('common')
  const tf = useT('forms')
  const e = useEnum()
  const reg = person.signatory
  const [registrationNo, setRegistrationNo] = useState(
    reg?.registrationNo ?? '',
  )
  const [council, setCouncil] = useState(reg?.council ?? '')
  const [departments, setDepartments] = useState<DepartmentId[]>(
    reg?.departments ??
      (person.department
        ? [person.department]
        : person.role === 'microbiologist'
          ? ['microbiology']
          : []),
  )
  const [validUntil, setValidUntil] = useState(
    reg?.validUntil !== undefined ? toDateInput(reg.validUntil) : '',
  )
  const [active, setActive] = useState(reg?.active ?? true)
  const [touched, setTouched] = useState(false)
  const errors = {
    registrationNo: registrationNo.trim() ? undefined : tf('required'),
    council: council.trim() ? undefined : tf('required'),
    departments: departments.length ? undefined : t('departmentsRequired'),
  }
  const save = useLabMutation(
    () =>
      labApi.admin.updateSignatory(person.id, {
        registrationNo: registrationNo.trim(),
        council: council.trim(),
        departments,
        active,
        ...(validUntil ? { validUntil: fromDateInput(validUntil) } : {}),
      }),
    {
      success: () => t('signatorySaved', { name: person.name }),
      onSuccess: onClose,
    },
  )
  const toggle = (d: DepartmentId, on: boolean) =>
    setDepartments((prev) =>
      on
        ? DEPARTMENTS.filter((x) => x === d || prev.includes(x))
        : prev.filter((x) => x !== d),
    )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        reg
          ? t('editSignatoryTitle', { name: person.name })
          : t('registerSignatoryTitle', { name: person.name })
      }
      description={[e('staffRole', person.role), person.qualification]
        .filter(Boolean)
        .join(' · ')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="signatory.manage"
            variant="primary"
            loading={save.isPending}
            onClick={() => {
              setTouched(true)
              if (!Object.values(errors).some(Boolean)) save.mutate()
            }}
          >
            {t('saveSignatory')}
          </GuardedButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('fieldRegistrationNo')}
          required
          error={touched ? errors.registrationNo : undefined}
        >
          <Input
            value={registrationNo}
            maxLength={40}
            autoComplete="off"
            className="font-mono"
            onChange={(ev) => setRegistrationNo(ev.target.value)}
          />
        </Field>
        <Field label={t('fieldValidUntil')} hint={t('fieldValidUntilHint')}>
          <Input
            type="date"
            value={validUntil}
            onChange={(ev) => setValidUntil(ev.target.value)}
          />
        </Field>
        <Field
          label={t('fieldCouncil')}
          required
          error={touched ? errors.council : undefined}
          className="sm:col-span-2"
        >
          <Input
            value={council}
            maxLength={100}
            placeholder={t('fieldCouncilPlaceholder')}
            onChange={(ev) => setCouncil(ev.target.value)}
          />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-fg">
            {t('fieldDepartments')}
          </legend>
          <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
            {DEPARTMENTS.map((d) => (
              <label
                key={d}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg"
              >
                <Checkbox
                  checked={departments.includes(d)}
                  onCheckedChange={(on) => toggle(d, on)}
                  label={e('department', d)}
                />
                <span>{e('department', d)}</span>
              </label>
            ))}
          </div>
          {touched && errors.departments ? (
            <p role="alert" className="mt-1 text-xs text-danger-text">
              {errors.departments}
            </p>
          ) : null}
        </fieldset>
        <div className="flex items-center justify-between gap-4 sm:col-span-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{t('fieldActive')}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {t('fieldActiveHint')}
            </p>
          </div>
          <Switch
            checked={active}
            onCheckedChange={setActive}
            label={t('fieldActive')}
          />
        </div>
      </div>
    </Dialog>
  )
}

/**
 * The signatory registry (NABL 112A): which pathologists and
 * microbiologists may authorise, for which departments, with their council
 * registration. Kept by the lab manager; the engine enforces it.
 */
export function SignatoryRegistry() {
  const t = useT('admin')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { data, isPending, isError, refetch } = useReference()
  const [editing, setEditing] = useState<Staff | null>(null)
  const [removing, setRemoving] = useState<Staff | null>(null)
  const remove = useLabMutation(
    (person: Staff) => labApi.admin.updateSignatory(person.id, null),
    {
      success: (_, person) => t('signatoryRemoved', { name: person.name }),
      onSuccess: () => setRemoving(null),
    },
  )
  const rows = data?.staff
    .filter((s) => SIGNING_ROLES.has(s.role))
    .toSorted(
      (a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name),
    )

  const columns: Column<Staff>[] = [
    {
      id: 'name',
      header: t('colName'),
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="block">
          <span className="block text-meta font-medium text-fg">{s.name}</span>
          <span className="block text-2xs text-fg-muted">
            {e('staffRole', s.role)}
          </span>
        </span>
      ),
    },
    {
      id: 'registration',
      header: t('colRegistration'),
      cell: (s) => (
        <span className="font-mono text-meta text-fg">
          {s.signatory?.registrationNo ?? '-'}
        </span>
      ),
    },
    {
      id: 'council',
      header: t('colCouncil'),
      tabletHidden: true,
      cell: (s) => (
        <span className="text-meta text-fg-muted">
          {s.signatory?.council ?? '-'}
        </span>
      ),
    },
    {
      id: 'departments',
      header: t('colDepartments'),
      cell: (s) => (
        <span className="text-meta text-fg">
          {s.signatory?.departments.length
            ? s.signatory.departments.map((d) => e('department', d)).join(', ')
            : '-'}
        </span>
      ),
    },
    {
      id: 'validUntil',
      header: t('colValidUntil'),
      sortValue: (s) => s.signatory?.validUntil ?? Infinity,
      cell: (s) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {!s.signatory
            ? '-'
            : s.signatory.validUntil !== undefined
              ? f.date(s.signatory.validUntil)
              : t('noExpiry')}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (s) => <SignatoryStatus state={stateOf(s, now)} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (s) => (
        <span className="flex justify-end gap-1.5">
          <GuardedButton
            permission="signatory.manage"
            size="xs"
            onClick={() => setEditing(s)}
          >
            {s.signatory ? t('editSignatory') : t('registerSignatory')}
          </GuardedButton>
          {s.signatory ? (
            <GuardedButton
              permission="signatory.manage"
              size="xs"
              variant="ghost"
              onClick={() => setRemoving(s)}
            >
              {t('removeSignatory')}
            </GuardedButton>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('signatoriesTitle')}
        description={t('signatoriesHint')}
        icon={<SignatureIcon />}
        tone="violet"
      />
      <DataTable
        caption={t('signatoriesTitle')}
        columns={columns}
        rows={rows}
        getRowId={(s) => s.id}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        mobile={{
          primary: 'name',
          fields: ['registration', 'departments', 'status'],
          actions: 'actions',
        }}
        empty={
          <EmptyState icon={<SignatureIcon />} title={t('signatoriesEmpty')} />
        }
      />
      {editing ? (
        <SignatoryDialog person={editing} onClose={() => setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('removeSignatoryTitle', { name: removing?.name ?? '' })}
        description={t('removeSignatoryBody')}
        confirmLabel={t('removeSignatory')}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing)
        }}
      />
    </Card>
  )
}
