import {
  CircleCheckIcon,
  LockIcon,
  LockOpenIcon,
  ScaleIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type LegalHoldRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { SigningAs } from '@/components/lab/signing-as'
import { Card, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import { PlaceHoldDialog } from './hold-dialog'
import { HOLD_FILTERS, type HoldFilter } from './privacy'

export function HoldsPanel({
  holds,
  isPending,
  isError,
  onRetry,
}: {
  holds: LegalHoldRow[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('privacy')
  const f = useFormat()
  const url = useUrlFilters({ holds: 'active' }, { holds: HOLD_FILTERS })
  const show = url.values.holds as HoldFilter
  const [placing, setPlacing] = useState(false)
  const [releasing, setReleasing] = useState<LegalHoldRow | null>(null)
  const rows = holds?.filter((h) =>
    show === 'all' ? true : (show === 'active') === !h.releasedAt,
  )

  const columns: Column<LegalHoldRow>[] = [
    {
      id: 'record',
      header: t('colRecord'),
      cell: (h) => (
        <div className="grid max-w-64 min-w-0 gap-0.5">
          <span className="text-xs text-fg-subtle">
            {t(`entity.${h.entity}`)}
          </span>
          <Link
            to={h.link}
            className="truncate py-0.5 text-meta font-medium text-fg hover:text-accent-text hover:underline"
          >
            {h.label}
          </Link>
        </div>
      ),
    },
    {
      id: 'reason',
      header: t('colReason'),
      cell: (h) => (
        <span className="line-clamp-2 max-w-72 text-meta text-fg-muted">
          {h.reason}
        </span>
      ),
    },
    {
      id: 'placed',
      header: t('colPlaced'),
      tabletHidden: true,
      cell: (h) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {f.date(h.placedAt)}
          </span>
          <span className="text-xs text-fg-muted">{h.placedByName}</span>
        </div>
      ),
    },
    {
      id: 'state',
      header: t('colState'),
      cell: (h) =>
        h.releasedAt ? (
          <div className="grid gap-0.5">
            <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-fg-muted">
              <LockOpenIcon className="size-3.5" aria-hidden />
              {t('holdReleased')}
            </span>
            <span className="text-xs text-fg-muted">
              {t('releasedBy', {
                time: f.date(h.releasedAt),
                name: h.releasedByName ?? '',
              })}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-warning-text">
            <LockIcon className="size-3.5" aria-hidden />
            {t('holdActive')}
          </span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (h) =>
        h.releasedAt ? null : (
          <GuardedButton
            permission="privacy.manage"
            size="xs"
            aria-label={t('releaseNamed', { name: h.label })}
            onClick={() => setReleasing(h)}
          >
            <LockOpenIcon />
            {t('release')}
          </GuardedButton>
        ),
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('holdsTitle')}
        description={t('holdsDescription')}
        icon={<ScaleIcon />}
        tone="amber"
        action={
          <GuardedButton
            permission="privacy.manage"
            variant="primary"
            onClick={() => setPlacing(true)}
          >
            <LockIcon />
            {t('placeHold')}
          </GuardedButton>
        }
      />
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <Segmented
          size="sm"
          aria-label={t('showHolds')}
          value={show}
          onValueChange={(v) => url.set({ holds: v })}
          options={HOLD_FILTERS.map((v) => ({
            value: v,
            label: t(`holdFilter.${v}`),
          }))}
        />
      </div>
      <div className="border-t border-line">
        <DataTable
          caption={t('holdsTitle')}
          columns={columns}
          rows={rows}
          getRowId={(h) => h.id}
          isLoading={isPending}
          isError={isError}
          onRetry={onRetry}
          pageSize={20}
          mobile={{
            primary: 'record',
            fields: ['reason', 'state'],
            actions: 'actions',
          }}
          empty={
            <EmptyState
              compact
              icon={<CircleCheckIcon />}
              tone="amber"
              title={t('holdsEmpty')}
              description={t('holdsEmptyBody')}
            />
          }
        />
      </div>
      <PlaceHoldDialog open={placing} onOpenChange={setPlacing} />
      <ReleaseDialog hold={releasing} onClose={() => setReleasing(null)} />
    </Card>
  )
}

function ReleaseDialog({
  hold,
  onClose,
}: {
  hold: LegalHoldRow | null
  onClose: () => void
}) {
  const t = useT('privacy')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const close = () => {
    setReason('')
    setTried(false)
    onClose()
  }
  const release = useLabMutation(
    (v: { id: string; reason: string }) =>
      labApi.privacy.releaseHold(v.id, v.reason),
    { success: () => t('holdReleasedToast'), onSuccess: () => close() },
  )
  const error = tried && !reason.trim() ? t('reasonRequired') : undefined
  return (
    <ConfirmDialog
      open={hold !== null}
      onOpenChange={(o) => !o && close()}
      title={t('releaseTitle')}
      description={hold ? t('releaseDescription', { name: hold.label }) : ''}
      confirmLabel={t('release')}
      tone="danger"
      loading={release.isPending}
      onConfirm={() => {
        setTried(true)
        if (!hold || !reason.trim()) return
        release.mutate({ id: hold.id, reason: reason.trim() })
      }}
    >
      <div className="grid gap-3">
        <Field label={t('fieldReleaseReason')} required error={error}>
          <Textarea
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
          />
        </Field>
        <SigningAs permission="privacy.manage" compact />
      </div>
    </ConfirmDialog>
  )
}
