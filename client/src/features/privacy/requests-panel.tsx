import {
  BanIcon,
  CircleCheckIcon,
  FilePlus2Icon,
  InboxIcon,
  LockIcon,
  StepForwardIcon,
} from 'lucide-react'
import { useState } from 'react'
import { DAY } from '@/domain/time'
import type { DataRequestState } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type DataRequestRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { RecordLink } from '@/components/lab/record-link'
import { SigningAs } from '@/components/lab/signing-as'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import {
  isRequestOpen,
  REQUEST_FILTERS,
  REQUEST_FORWARD,
  type RequestFilter,
} from './privacy'
import {
  EventTimeline,
  HoldFlag,
  Item,
  OverdueFlag,
  RequestState,
} from './privacy-ui'
import { LogRequestDialog } from './request-dialog'

export function RequestsPanel({
  requests,
  isPending,
  isError,
  onRetry,
}: {
  requests: DataRequestRow[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('privacy')
  const f = useFormat()
  const url = useUrlFilters({ show: 'open' }, { show: REQUEST_FILTERS })
  const show = url.values.show as RequestFilter
  const [openId, setOpenId, closeOpen] = useOverlayParam('request')
  const [logging, setLogging] = useState(false)
  const rows = requests?.filter((r) =>
    show === 'all'
      ? true
      : show === 'open'
        ? isRequestOpen(r.state)
        : !isRequestOpen(r.state),
  )
  const selected = requests?.find((r) => r.id === openId)

  const columns: Column<DataRequestRow>[] = [
    {
      id: 'number',
      header: t('colNumber'),
      cell: (r) => (
        <span className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
          {r.requestNo}
        </span>
      ),
    },
    {
      id: 'kind',
      header: t('colKind'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg">
          {t(`kind.${r.kind}`)}
        </span>
      ),
    },
    {
      id: 'requester',
      header: t('colRequester'),
      cell: (r) => (
        <div className="grid max-w-56 min-w-0 gap-0.5">
          <span className="truncate text-meta font-medium text-fg">
            {r.requesterName}
          </span>
          <span className="truncate text-xs text-fg-muted">{r.contact}</span>
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      tabletHidden: true,
      cell: (r) =>
        r.patientId ? (
          <RecordLink
            kind="patient"
            id={r.patientId}
            mono={false}
            className="text-meta text-fg"
          >
            {r.patientName ?? r.patientId}
          </RecordLink>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
    {
      id: 'received',
      header: t('colReceived'),
      tabletHidden: true,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {f.date(r.receivedAt)}
        </span>
      ),
    },
    {
      id: 'due',
      header: t('colDue'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {f.date(r.dueAt)}
          </span>
          {r.overdue ? <OverdueFlag /> : null}
        </div>
      ),
    },
    {
      id: 'state',
      header: t('colState'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <RequestState state={r.state} />
          {r.onHold ? <HoldFlag /> : null}
        </div>
      ),
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('requestsTitle')}
        description={t('requestsDescription')}
        icon={<InboxIcon />}
        tone="violet"
        action={
          <GuardedButton
            permission="privacy.manage"
            variant="primary"
            onClick={() => setLogging(true)}
          >
            <FilePlus2Icon />
            {t('logRequest')}
          </GuardedButton>
        }
      />
      <div className="border-t border-line px-4 py-2.5 sm:px-5">
        <Segmented
          size="sm"
          aria-label={t('showRequests')}
          value={show}
          onValueChange={(v) => url.set({ show: v })}
          options={REQUEST_FILTERS.map((v) => ({
            value: v,
            label: t(`requestFilter.${v}`),
          }))}
        />
      </div>
      <div className="border-t border-line">
        <DataTable
          caption={t('requestsTitle')}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          isLoading={isPending}
          isError={isError}
          onRetry={onRetry}
          onRowClick={(r) => setOpenId(r.id)}
          rowLabel={(r) => r.requestNo}
          activeRowId={selected?.id ?? null}
          rowClassName={(r) => (r.overdue ? 'row-alert' : undefined)}
          pageSize={20}
          mobile={{ primary: 'number', fields: ['kind', 'due', 'state'] }}
          empty={
            <EmptyState
              compact
              icon={<InboxIcon />}
              tone="violet"
              title={t('requestsEmpty')}
              description={t('requestsEmptyBody')}
            />
          }
        />
      </div>
      <RequestDrawer request={selected} onClose={closeOpen} />
      <LogRequestDialog
        open={logging}
        onOpenChange={setLogging}
        onLogged={(id) => {
          setLogging(false)
          setOpenId(id)
        }}
      />
    </Card>
  )
}

function RequestDrawer({
  request,
  onClose,
}: {
  request: DataRequestRow | undefined
  onClose: () => void
}) {
  const t = useT('privacy')
  return (
    <Drawer
      open={Boolean(request)}
      onOpenChange={(o) => !o && onClose()}
      title={
        request ? (
          <span className="font-mono">{request.requestNo}</span>
        ) : (
          t('requestsTitle')
        )
      }
      headerExtra={request ? <RequestState state={request.state} /> : null}
      description={request ? t(`kind.${request.kind}`) : undefined}
    >
      {request ? <RequestDetail key={request.id} request={request} /> : null}
    </Drawer>
  )
}

function RequestDetail({ request }: { request: DataRequestRow }) {
  const t = useT('privacy')
  const f = useFormat()
  const now = useNow()
  const [response, setResponse] = useState('')
  const [tried, setTried] = useState(false)
  const advance = useLabMutation(
    (v: { to: DataRequestState; response?: string }) =>
      labApi.privacy.advanceRequest(request.id, v),
    {
      success: (_, v) => t('requestMoved', { state: t(`state.${v.to}`) }),
      onSuccess: () => {
        setResponse('')
        setTried(false)
      },
    },
  )
  const open = isRequestOpen(request.state)
  const forward = REQUEST_FORWARD[request.state]
  const responseError =
    tried && !response.trim() ? t('responseRequired') : undefined
  const close = (to: 'completed' | 'refused') => {
    setTried(true)
    if (!response.trim()) return
    advance.mutate({ to, response: response.trim() })
  }
  const erasureHeld = request.kind === 'erasure' && request.onHold

  return (
    <div className="grid gap-6">
      {request.overdue ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-meta text-danger-text"
        >
          <span className="mt-0.5">
            <OverdueFlag />
          </span>
          {t('overdueBody', {
            count: Math.max(1, Math.ceil((now - request.dueAt) / DAY)),
          })}
        </p>
      ) : null}
      {request.onHold ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-warning-soft px-3.5 py-3 text-meta text-warning-text"
        >
          <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erasureHeld ? t('holdErasureBody') : t('holdBody')}
        </p>
      ) : null}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Item label={t('colKind')}>{t(`kind.${request.kind}`)}</Item>
        <Item label={t('colPatient')}>
          {request.patientId ? (
            <RecordLink kind="patient" id={request.patientId} mono={false}>
              {request.patientName ?? request.patientId}
            </RecordLink>
          ) : (
            t('noPatient')
          )}
        </Item>
        <Item label={t('colRequester')}>{request.requesterName}</Item>
        <Item label={t('fieldContact')}>{request.contact}</Item>
        <Item label={t('colReceived')}>{f.dateTime(request.receivedAt)}</Item>
        <Item label={t('colDue')}>{f.dateTime(request.dueAt)}</Item>
        {request.closedAt ? (
          <Item label={t('closedAt')}>{f.dateTime(request.closedAt)}</Item>
        ) : null}
      </dl>

      <section className="grid gap-1.5">
        <h3 className="text-sm font-semibold text-fg">{t('fieldDetails')}</h3>
        <p className="text-sm whitespace-pre-line text-fg">{request.details}</p>
      </section>

      {request.response ? (
        <section className="grid gap-1.5">
          <h3 className="text-sm font-semibold text-fg">{t('response')}</h3>
          <p className="rounded-lg bg-surface-2 px-3.5 py-3 text-sm whitespace-pre-line text-fg">
            {request.response}
          </p>
        </section>
      ) : null}

      {open ? (
        <section className="grid gap-3 rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold text-fg">{t('nextStep')}</h3>
          {forward && forward !== 'completed' ? (
            <div>
              <GuardedButton
                permission="privacy.manage"
                variant="primary"
                loading={advance.isPending && advance.variables?.to === forward}
                disabled={advance.isPending}
                onClick={() => advance.mutate({ to: forward })}
              >
                <StepForwardIcon />
                {t(`moveTo.${forward}`)}
              </GuardedButton>
            </div>
          ) : null}
          <Field
            label={t('response')}
            hint={t('responseHint')}
            error={responseError}
          >
            <Textarea
              rows={3}
              maxLength={2000}
              value={response}
              onChange={(ev) => setResponse(ev.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {forward === 'completed' ? (
              <GuardedButton
                permission="privacy.manage"
                variant="primary"
                loading={
                  advance.isPending && advance.variables?.to === 'completed'
                }
                disabled={advance.isPending}
                onClick={() => close('completed')}
              >
                <CircleCheckIcon />
                {t('moveTo.completed')}
              </GuardedButton>
            ) : null}
            <GuardedButton
              permission="privacy.manage"
              variant="danger-soft"
              loading={advance.isPending && advance.variables?.to === 'refused'}
              disabled={advance.isPending}
              onClick={() => close('refused')}
            >
              <BanIcon />
              {t('moveTo.refused')}
            </GuardedButton>
          </div>
          {forward !== 'completed' ? (
            <p className="text-xs text-fg-subtle">{t('completeLater')}</p>
          ) : null}
          <SigningAs permission="privacy.manage" compact />
        </section>
      ) : null}

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-fg">{t('history')}</h3>
        <EventTimeline entries={request.history} />
      </section>
    </div>
  )
}
