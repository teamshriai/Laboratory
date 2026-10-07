import { RecordLink } from '@/components/lab/record-link'
import { InboxIcon, RotateCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { INTERFACE_DIRECTIONS, INTERFACE_STATES } from '@/domain/types'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi } from '@/services/lab-api'
import type { InterfaceMessageRow, InterfaceOverview } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { FilterBar } from '@/components/lab/filter-bar'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { DirectionLabel, MessageStateBadge } from './interface-status'
import {
  DIRECTION_FILTERS,
  STATE_FILTERS,
  type MappingDraft,
} from './interfaces'
import { MessageDrawer } from './message-drawer'

const DEFAULTS = { analyser: 'all', state: 'all', direction: 'all' }

/** The recent traffic, newest first, with a retry for failed messages. */
export function MessagesPanel({
  data,
  isPending,
  isError,
  onRetry,
  onMap,
}: {
  data: InterfaceOverview | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  onMap: (draft: MappingDraft) => void
}) {
  const t = useT('interfaces')
  const tc = useT('common')
  const f = useFormat()
  const analysers = data?.interfaces ?? []
  const url = useUrlFilters(DEFAULTS, {
    analyser: ['all', ...analysers.map((a) => a.equipmentId)],
    state: STATE_FILTERS,
    direction: DIRECTION_FILTERS,
  })
  const { analyser, state, direction } = url.values
  const [openId, setOpenId, closeOpen] = useOverlayParam('message')
  const filtered = url.activeCount() > 0

  const retry = useLabMutation(
    (m: InterfaceMessageRow) => labApi.interfaces.retry(m.id),
    {
      success: (next) => (next === 'processed' ? t('retryProcessed') : null),
      onSuccess: (next, m) => {
        if (next !== 'processed')
          toast.warning(t('retryStillFailed'), {
            description: m.error
              ? t(`errorHelp.${m.error}`, { code: m.instrumentCode ?? '-' })
              : undefined,
          })
      },
    },
  )
  const map = (m: InterfaceMessageRow) => {
    closeOpen()
    onMap({
      equipmentId: m.equipmentId,
      ...(m.instrumentCode ? { instrumentCode: m.instrumentCode } : {}),
    })
  }

  const rows = data?.messages.filter(
    (m) =>
      (analyser === 'all' || m.equipmentId === analyser) &&
      (state === 'all' || m.state === state) &&
      (direction === 'all' || m.direction === direction),
  )
  const open = openId ? data?.messages.find((m) => m.id === openId) : undefined

  const columns: Column<InterfaceMessageRow>[] = [
    {
      id: 'time',
      header: tc('time'),
      sortValue: (m) => m.at,
      cell: (m) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.dateTime(m.at)}
        </span>
      ),
    },
    {
      id: 'analyser',
      header: t('analyser'),
      sortValue: (m) => m.equipmentName,
      cell: (m) => (
        <div className="max-w-56 min-w-0">
          <p className="truncate text-meta font-medium text-fg">
            {m.equipmentName}
          </p>
          <p className="font-mono text-xs text-fg-muted">{m.protocol}</p>
        </div>
      ),
    },
    {
      id: 'direction',
      header: t('colDirection'),
      sortValue: (m) => m.direction,
      cell: (m) => (
        <div className="grid gap-0.5">
          <DirectionLabel direction={m.direction} />
          <span className="text-xs text-fg-subtle">{t(`kind.${m.kind}`)}</span>
        </div>
      ),
    },
    {
      id: 'accession',
      header: t('colAccession'),
      sortValue: (m) => m.accessionNo ?? '',
      cell: (m) => (
        <div className="grid gap-0.5">
          {m.sampleId && m.accessionNo ? (
            <RecordLink kind="specimen" id={m.sampleId}>
              {m.accessionNo}
            </RecordLink>
          ) : (
            <span className="font-mono text-meta whitespace-nowrap text-fg tabular-nums">
              {m.accessionNo ?? '-'}
            </span>
          )}
          {m.instrumentCode ? (
            <span className="font-mono text-xs text-fg-muted">
              {t('codeValue', { code: m.instrumentCode })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'state',
      header: tc('status'),
      sortValue: (m) => m.state,
      cell: (m) => (
        <div className="grid justify-items-start gap-0.5">
          <MessageStateBadge state={m.state} />
          {m.error ? (
            <span className="max-w-52 text-xs text-fg-muted">
              {t(`error.${m.error}`)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'retries',
      header: t('colRetries'),
      align: 'right',
      tabletHidden: true,
      sortValue: (m) => m.retries,
      cell: (m) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {f.number(m.retries)}
        </span>
      ),
    },
    {
      id: 'frame',
      header: t('frame'),
      tabletHidden: true,
      mobileHidden: true,
      cell: (m) => (
        <code className="block max-w-56 truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">
          {m.frame}
        </code>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (m) =>
        m.state === 'error' ? (
          <GuardedButton
            permission="interface.manage"
            size="xs"
            aria-label={t('retryNamed', { name: m.equipmentName })}
            loading={retry.isPending && retry.variables.id === m.id}
            onClick={(ev) => {
              ev.stopPropagation()
              retry.mutate(m)
            }}
          >
            <RotateCwIcon />
            {t('retry')}
          </GuardedButton>
        ) : null,
    },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <FilterBar canClear={filtered} onClear={() => url.clear()}>
          <Select
            size="sm"
            aria-label={t('filterAnalyser')}
            value={analyser}
            onValueChange={(v) => url.set({ analyser: v })}
            options={[
              { value: 'all', label: t('allAnalysers') },
              ...analysers.map((a) => ({
                value: a.equipmentId,
                label: a.name,
              })),
            ]}
            className="w-full sm:w-56"
          />
          <Select
            size="sm"
            aria-label={t('filterState')}
            value={state}
            onValueChange={(v) => url.set({ state: v })}
            options={[
              { value: 'all', label: t('allStates') },
              ...INTERFACE_STATES.map((s) => ({
                value: s,
                label: t(`state.${s}`),
              })),
            ]}
            className="w-full sm:w-40"
          />
          <Select
            size="sm"
            aria-label={t('filterDirection')}
            value={direction}
            onValueChange={(v) => url.set({ direction: v })}
            options={[
              { value: 'all', label: t('allDirections') },
              ...INTERFACE_DIRECTIONS.map((d) => ({
                value: d,
                label: t(`direction.${d}`),
              })),
            ]}
            className="w-full sm:w-44"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('tabMessages')}
            columns={columns}
            rows={rows}
            getRowId={(m) => m.id}
            rowLabel={(m) =>
              t('messageRowLabel', {
                analyser: m.equipmentName,
                time: f.dateTime(m.at),
              })
            }
            onRowClick={(m) => setOpenId(m.id)}
            activeRowId={openId}
            rowClassName={(m) =>
              m.state === 'error' ? 'row-alert' : undefined
            }
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={25}
            initialSort={{ id: 'time', desc: true }}
            mobile={{
              primary: 'analyser',
              fields: ['time', 'direction', 'accession', 'state'],
              actions: 'actions',
            }}
            empty={
              <EmptyState
                icon={<InboxIcon />}
                tone="teal"
                title={
                  filtered ? t('messagesEmptyFiltered') : t('messagesEmpty')
                }
                description={
                  filtered
                    ? t('messagesEmptyFilteredBody')
                    : t('messagesEmptyBody')
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={() => url.clear()}>
                      {tc('clearFilters')}
                    </Button>
                  ) : null
                }
              />
            }
          />
        </div>
      </Card>
      {openId ? (
        <MessageDrawer
          message={open}
          isPending={isPending}
          retrying={retry.isPending}
          onRetry={(m) => retry.mutate(m)}
          onMap={map}
          onClose={closeOpen}
        />
      ) : null}
    </>
  )
}
