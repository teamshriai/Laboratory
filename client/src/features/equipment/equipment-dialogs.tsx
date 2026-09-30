import { useState } from 'react'
import { DAY } from '@/domain/time'
import { MAINTENANCE_KINDS, type MaintenanceKind } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { fromDateInput, toDateInput } from '@/lib/date-input'
import { labApi, type EquipmentDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/toggles'

export type EquipmentDialogKind =
  'schedule' | 'complete' | 'calibration' | 'note' | 'service' | 'breakdown'

function Footer({
  onClose,
  onSave,
  loading,
  label,
}: {
  onClose: () => void
  onSave: () => void
  loading: boolean
  label: string
}) {
  const tc = useT('common')
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        {tc('cancel')}
      </Button>
      <Button variant="primary" loading={loading} onClick={onSave}>
        {label}
      </Button>
    </>
  )
}

function ScheduleDialog({
  eq,
  onClose,
}: {
  eq: EquipmentDetail
  onClose: () => void
}) {
  const t = useT('equipment')
  const tf = useT('forms')
  const e = useEnum()
  const now = useNow()
  const [kind, setKind] = useState<MaintenanceKind>('preventive')
  const [due, setDue] = useState(toDateInput(now + 7 * DAY))
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(eq.serviceProvider ?? '')
  const [touched, setTouched] = useState(false)
  const save = useLabMutation(
    () =>
      labApi.equipment.scheduleMaintenance(eq.id, {
        kind,
        dueAt: fromDateInput(due),
        title,
        assignee,
      }),
    {
      success: () => t('scheduledToast', { name: eq.name }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('schedule')}
      description={eq.name}
      footer={
        <Footer
          onClose={onClose}
          loading={save.isPending}
          label={t('save')}
          onSave={() => {
            setTouched(true)
            if (title.trim() && due) save.mutate()
          }}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('kind')}>
          <Select
            value={kind}
            onValueChange={setKind}
            options={MAINTENANCE_KINDS.map((k) => ({
              value: k,
              label: e('maintenanceKind', k),
            }))}
          />
        </Field>
        <Field label={t('dueDate')} required>
          <Input
            type="date"
            value={due}
            min={toDateInput(now)}
            onChange={(ev) => setDue(ev.target.value)}
          />
        </Field>
        <Field
          label={t('taskTitle')}
          required
          error={touched && !title.trim() ? tf('required') : undefined}
          className="sm:col-span-2"
        >
          <Input
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            placeholder={t('taskTitlePlaceholder')}
            maxLength={120}
          />
        </Field>
        <Field label={t('assignee')} className="sm:col-span-2">
          <Input
            value={assignee}
            onChange={(ev) => setAssignee(ev.target.value)}
            maxLength={80}
          />
        </Field>
      </div>
    </Dialog>
  )
}

function CompleteDialog({
  eq,
  taskId,
  onClose,
}: {
  eq: EquipmentDetail
  taskId?: string | undefined
  onClose: () => void
}) {
  const t = useT('equipment')
  const tf = useT('forms')
  const tc = useT('common')
  const now = useNow()
  const task =
    eq.maintenancePlan.find((m) => m.id === taskId) ??
    eq.maintenancePlan.find((m) => m.status === 'scheduled')
  const [date, setDate] = useState(toDateInput(now))
  const [engineer, setEngineer] = useState(
    task?.assignee ?? eq.serviceProvider ?? '',
  )
  const [work, setWork] = useState(task?.title ?? '')
  const [downtime, setDowntime] = useState('60')
  const [next, setNext] = useState(toDateInput(now + 30 * DAY))
  const [remarks, setRemarks] = useState('')
  const [touched, setTouched] = useState(false)
  const performedAt = Math.min(fromDateInput(date), now)
  const errors = {
    work: !work.trim() ? tf('required') : undefined,
    downtime: !(Number(downtime) >= 0) ? tf('positive') : undefined,
    next: fromDateInput(next) <= performedAt ? tf('pastDate') : undefined,
  }
  const save = useLabMutation(
    () =>
      labApi.equipment.completeMaintenance(eq.id, {
        ...(task ? { taskId: task.id } : {}),
        performedAt,
        performedBy: engineer,
        work,
        downtimeMin: Number(downtime),
        nextDueAt: fromDateInput(next),
        ...(remarks.trim() ? { remarks } : {}),
      }),
    {
      success: () => t('completedToast', { name: eq.name }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('completeTitle')}
      description={eq.name}
      size="lg"
      footer={
        <Footer
          onClose={onClose}
          loading={save.isPending}
          label={t('complete')}
          onSave={() => {
            setTouched(true)
            if (!errors.work && !errors.downtime && !errors.next) save.mutate()
          }}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('performedAt')} required>
          <Input
            type="date"
            value={date}
            max={toDateInput(now)}
            onChange={(ev) => setDate(ev.target.value)}
          />
        </Field>
        <Field label={t('engineer')}>
          <Input
            value={engineer}
            onChange={(ev) => setEngineer(ev.target.value)}
            maxLength={80}
          />
        </Field>
        <Field
          label={t('work')}
          required
          error={touched ? errors.work : undefined}
          className="sm:col-span-2"
        >
          <Textarea
            rows={3}
            value={work}
            onChange={(ev) => setWork(ev.target.value)}
            placeholder={t('workPlaceholder')}
            maxLength={400}
          />
        </Field>
        <Field
          label={t('downtime')}
          error={touched ? errors.downtime : undefined}
        >
          <Input
            type="number"
            min={0}
            step={5}
            value={downtime}
            onChange={(ev) => setDowntime(ev.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('nextDueDate')}
          required
          error={touched ? errors.next : undefined}
        >
          <Input
            type="date"
            value={next}
            min={toDateInput(now + DAY)}
            onChange={(ev) => setNext(ev.target.value)}
          />
        </Field>
        <Field
          label={t('remarks')}
          optionalLabel={tc('optional')}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={remarks}
            onChange={(ev) => setRemarks(ev.target.value)}
            maxLength={300}
          />
        </Field>
      </div>
    </Dialog>
  )
}

function CalibrationDialog({
  eq,
  onClose,
}: {
  eq: EquipmentDetail
  onClose: () => void
}) {
  const t = useT('equipment')
  const tf = useT('forms')
  const tc = useT('common')
  const now = useNow()
  const [date, setDate] = useState(toDateInput(now))
  const [result, setResult] = useState<'pass' | 'fail'>('pass')
  const [cert, setCert] = useState('')
  const [next, setNext] = useState(toDateInput(now + 90 * DAY))
  const [remarks, setRemarks] = useState('')
  const [touched, setTouched] = useState(false)
  const performedAt = Math.min(fromDateInput(date), now)
  const errors = {
    cert: !cert.trim() ? tf('required') : undefined,
    next:
      result === 'pass' && fromDateInput(next) <= performedAt
        ? tf('pastDate')
        : undefined,
  }
  const save = useLabMutation(
    () =>
      labApi.equipment.recordCalibration(eq.id, {
        performedAt,
        result,
        certificateNo: cert,
        nextDueAt: fromDateInput(next),
        ...(remarks.trim() ? { remarks } : {}),
      }),
    {
      success: () => t('calibratedToast', { name: eq.name }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('recordCalibration')}
      description={eq.name}
      footer={
        <Footer
          onClose={onClose}
          loading={save.isPending}
          label={t('save')}
          onSave={() => {
            setTouched(true)
            if (!errors.cert && !errors.next) save.mutate()
          }}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('performedAt')} required>
          <Input
            type="date"
            value={date}
            max={toDateInput(now)}
            onChange={(ev) => setDate(ev.target.value)}
          />
        </Field>
        <Field label={t('calResult')}>
          <Segmented
            value={result}
            onValueChange={setResult}
            aria-label={t('calResult')}
            options={[
              { value: 'pass', label: t('calPass') },
              { value: 'fail', label: t('calFail') },
            ]}
          />
        </Field>
        <Field
          label={t('certificateNo')}
          required
          error={touched ? errors.cert : undefined}
        >
          <Input
            value={cert}
            onChange={(ev) => setCert(ev.target.value)}
            placeholder="CAL/2026/0418"
            className="font-mono"
            maxLength={40}
          />
        </Field>
        {result === 'pass' ? (
          <Field
            label={t('nextCalibration')}
            required
            error={touched ? errors.next : undefined}
          >
            <Input
              type="date"
              value={next}
              min={toDateInput(now + DAY)}
              onChange={(ev) => setNext(ev.target.value)}
            />
          </Field>
        ) : (
          <p className="self-end rounded-lg bg-warning-soft px-3 py-2 text-meta text-warning-text">
            {t('calFailNotice')}
          </p>
        )}
        <Field
          label={t('remarks')}
          optionalLabel={tc('optional')}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={remarks}
            onChange={(ev) => setRemarks(ev.target.value)}
            maxLength={300}
          />
        </Field>
      </div>
    </Dialog>
  )
}

function LogDialog({
  eq,
  mode,
  onClose,
}: {
  eq: EquipmentDetail
  mode: 'note' | 'service' | 'breakdown'
  onClose: () => void
}) {
  const t = useT('equipment')
  const tf = useT('forms')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const save = useLabMutation(
    () =>
      labApi.equipment.log(eq.id, {
        type:
          mode === 'service'
            ? 'service-visit'
            : mode === 'breakdown'
              ? 'breakdown'
              : 'note',
        note,
      }),
    {
      success: () =>
        mode === 'breakdown'
          ? t('breakdownToast', { name: eq.name })
          : mode === 'service'
            ? t('serviceToast', { name: eq.name })
            : t('notedToast', { name: eq.name }),
      onSuccess: onClose,
    },
  )
  const title =
    mode === 'breakdown'
      ? t('reportBreakdown')
      : mode === 'service'
        ? t('recordService')
        : t('addNote')
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={eq.name}
      footer={
        <Footer
          onClose={onClose}
          loading={save.isPending}
          label={t('save')}
          onSave={() => {
            setTouched(true)
            if (note.trim()) save.mutate()
          }}
        />
      }
    >
      <div className="grid gap-3">
        {mode === 'breakdown' ? (
          <p className="rounded-lg bg-danger-soft/60 px-3 py-2 text-meta text-danger-text">
            {t('breakdownNotice')}
          </p>
        ) : null}
        <Field
          label={t('note')}
          required
          error={touched && !note.trim() ? tf('required') : undefined}
        >
          <Textarea
            rows={4}
            autoFocus
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder={
              mode === 'breakdown'
                ? t('breakdownPlaceholder')
                : t('notePlaceholder')
            }
            maxLength={400}
          />
        </Field>
      </div>
    </Dialog>
  )
}

export function EquipmentDialogs({
  eq,
  kind,
  taskId,
  onClose,
}: {
  eq: EquipmentDetail
  kind: EquipmentDialogKind | null
  taskId?: string | undefined
  onClose: () => void
}) {
  switch (kind) {
    case 'schedule':
      return <ScheduleDialog eq={eq} onClose={onClose} />
    case 'complete':
      return <CompleteDialog eq={eq} taskId={taskId} onClose={onClose} />
    case 'calibration':
      return <CalibrationDialog eq={eq} onClose={onClose} />
    case 'note':
    case 'service':
    case 'breakdown':
      return <LogDialog eq={eq} mode={kind} onClose={onClose} />
    default:
      return null
  }
}
