import {
  ArchiveIcon,
  CalendarIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClipboardPenIcon,
  EyeIcon,
  HourglassIcon,
  LightbulbIcon,
  PencilLineIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type {
  DocumentState,
  FindingKind,
  InternalAuditState,
} from '@/domain/types'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { labApi } from '@/services/lab-api'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'

/** A titled block inside a drawer. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-6 last:mb-0', className)}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

const TEXT_TONES = {
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  info: 'text-info-text',
  muted: 'text-fg-muted',
} as const

/** A short status in words with its icon (never colour alone). */
export function StatusText({
  icon,
  tone,
  children,
  className,
}: {
  icon: ReactNode
  tone: keyof typeof TEXT_TONES
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0',
        TEXT_TONES[tone],
        className,
      )}
    >
      <span aria-hidden className="inline-flex">
        {icon}
      </span>
      {children}
    </span>
  )
}

const DOC_STATE: Record<DocumentState, { tone: BadgeTone; icon: ReactNode }> = {
  draft: { tone: 'neutral', icon: <PencilLineIcon /> },
  'in-review': { tone: 'warning', icon: <HourglassIcon /> },
  approved: { tone: 'success', icon: <CircleCheckIcon /> },
  retired: { tone: 'outline', icon: <ArchiveIcon /> },
}

export function DocumentStateBadge({ state }: { state: DocumentState }) {
  const t = useT('qualityRecords')
  const s = DOC_STATE[state]
  return (
    <Badge tone={s.tone} size="sm">
      <span aria-hidden className="inline-flex">
        {s.icon}
      </span>
      {t(`docState.${state}`)}
    </Badge>
  )
}

const AUDIT_STATE: Record<
  InternalAuditState,
  { tone: BadgeTone; icon: ReactNode }
> = {
  planned: { tone: 'info', icon: <CalendarIcon /> },
  'in-progress': { tone: 'accent', icon: <ClipboardPenIcon /> },
  completed: { tone: 'success', icon: <CircleCheckIcon /> },
  cancelled: { tone: 'outline', icon: <CircleSlashIcon /> },
}

export function AuditStateBadge({ state }: { state: InternalAuditState }) {
  const t = useT('qualityRecords')
  const s = AUDIT_STATE[state]
  return (
    <Badge tone={s.tone} size="sm">
      <span aria-hidden className="inline-flex">
        {s.icon}
      </span>
      {t(`auditState.${state}`)}
    </Badge>
  )
}

const FINDING: Record<FindingKind, { tone: BadgeTone; icon: ReactNode }> = {
  nonconformity: { tone: 'danger', icon: <CircleXIcon /> },
  observation: { tone: 'info', icon: <EyeIcon /> },
  opportunity: { tone: 'accent', icon: <LightbulbIcon /> },
}

export function FindingKindBadge({ kind }: { kind: FindingKind }) {
  const t = useT('qualityRecords')
  const s = FINDING[kind]
  return (
    <Badge tone={s.tone} size="sm">
      <span aria-hidden className="inline-flex">
        {s.icon}
      </span>
      {t(`findingKind.${kind}`)}
    </Badge>
  )
}

export function OutcomeBadge({ outcome }: { outcome: 'pass' | 'fail' }) {
  const t = useT('qualityRecords')
  return outcome === 'pass' ? (
    <Badge tone="success" size="sm">
      <CircleCheckIcon aria-hidden />
      {t('outcome.pass')}
    </Badge>
  ) : (
    <Badge tone="danger" size="sm">
      <CircleXIcon aria-hidden />
      {t('outcome.fail')}
    </Badge>
  )
}

/**
 * One required free-text answer (a reason, a summary, a note) behind a
 * confirmation. Mount it only while open so it starts empty.
 */
export function TextDialog({
  onClose,
  title,
  description,
  label,
  hint,
  placeholder,
  confirmLabel,
  tone = 'primary',
  loading,
  required = true,
  maxLength = 2000,
  onConfirm,
  children,
}: {
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  label: string
  hint?: ReactNode
  placeholder?: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  loading?: boolean
  required?: boolean
  maxLength?: number
  onConfirm: (text: string) => void
  children?: ReactNode
}) {
  const tc = useT('common')
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const missing = required && !text.trim()
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      loading={loading}
      onConfirm={() => {
        setTouched(true)
        if (!missing) onConfirm(text.trim())
      }}
    >
      <div className="grid gap-4">
        {children}
        <Field
          label={label}
          required={required}
          optionalLabel={required ? undefined : tc('optional')}
          hint={hint}
          error={touched && missing ? 'forms.required' : undefined}
        >
          <Textarea
            rows={3}
            value={text}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(ev) => setText(ev.target.value)}
          />
        </Field>
      </div>
    </ConfirmDialog>
  )
}

/**
 * An accession number that opens its specimen. The verification run keeps
 * only the accession number, so the specimen is looked up on click.
 */
export function AccessionLink({ accessionNo }: { accessionNo: string }) {
  const t = useT('qualityRecords')
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      const found = await labApi.samples.lookup(accessionNo)
      if (found) void navigate(`/specimens/${found.id}`)
      else toast.error(t('specimenNotFound', { accession: accessionNo }))
    } catch {
      toast.error(t('specimenNotFound', { accession: accessionNo }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation()
        void open()
      }}
      aria-busy={busy || undefined}
      aria-label={t('openSpecimen', { accession: accessionNo })}
      className="focus-ring inline-flex min-h-6 items-center rounded-sm py-0.5 font-mono text-meta font-semibold whitespace-nowrap text-fg tabular-nums underline-offset-2 hover:text-accent-text hover:underline"
    >
      {accessionNo}
    </button>
  )
}
