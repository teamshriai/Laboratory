import { InboxIcon } from 'lucide-react'
import { useDeferredValue } from 'react'
import {
  MESSAGE_CHANNELS,
  MESSAGE_EVENTS,
  MESSAGE_STATES,
} from '@/domain/types'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import type { MessagingView } from '@/services/lab-api'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { ChannelLabel, MessageStateBadge } from './channel'
import { MessageDrawer } from './message-drawer'

type Row = MessagingView['outbox'][number]

const DEFAULTS = { q: '', channel: 'all', state: 'all', event: 'all' }
const CHANNELS = ['all', ...MESSAGE_CHANNELS] as const
const STATES = ['all', ...MESSAGE_STATES] as const
const EVENTS = ['all', ...MESSAGE_EVENTS] as const

/** Every message the lab recorded for sending, newest first. */
export function OutboxPanel({
  outbox,
  isPending,
  isError,
  onRetry,
}: {
  outbox: Row[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const url = useUrlFilters(DEFAULTS, {
    channel: CHANNELS,
    state: STATES,
    event: EVENTS,
  })
  const channel = url.values.channel as (typeof CHANNELS)[number]
  const state = url.values.state as (typeof STATES)[number]
  const event = url.values.event as (typeof EVENTS)[number]
  const q = useDeferredValue(url.values.q).trim().toLowerCase()
  const [openId, setOpenId, closeOpen] = useOverlayParam('message')
  const filtered = url.activeCount() > 0

  const rows = outbox?.filter(
    (m) =>
      (channel === 'all' || m.channel === channel) &&
      (state === 'all' || m.state === state) &&
      (event === 'all' || m.event === event) &&
      (!q ||
        [m.to, m.patientName, m.byName, m.text].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  )
  const open = openId ? outbox?.find((m) => m.id === openId) : undefined

  const columns: Column<Row>[] = [
    {
      id: 'time',
      header: t('colTime'),
      sortValue: (m) => m.at,
      cell: (m) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.dateTime(m.at)}
        </span>
      ),
    },
    {
      id: 'event',
      header: t('colEvent'),
      sortValue: (m) => m.event,
      cell: (m) => (
        <span className="text-meta text-fg">{e('messageEvent', m.event)}</span>
      ),
    },
    {
      id: 'channel',
      header: t('colChannel'),
      sortValue: (m) => m.channel,
      cell: (m) => <ChannelLabel channel={m.channel} />,
    },
    {
      id: 'recipient',
      header: t('colRecipient'),
      cell: (m) => (
        <span className="text-meta break-all text-fg tabular-nums">{m.to}</span>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (m) => m.patientName ?? '',
      cell: (m) =>
        m.patientId ? (
          <RecordLink
            kind="patient"
            id={m.patientId}
            mono={false}
            className="py-0.5 text-meta text-fg"
          >
            {m.patientName ?? t('openPatient')}
          </RecordLink>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
    {
      id: 'language',
      header: t('colLanguage'),
      tabletHidden: true,
      cell: (m) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {LANGUAGE_NAMES[m.language]}
        </span>
      ),
    },
    {
      id: 'state',
      header: t('colState'),
      sortValue: (m) => m.state,
      cell: (m) => (
        <div className="grid justify-items-start gap-0.5">
          <MessageStateBadge state={m.state} />
          {m.reason ? (
            <span className="max-w-56 text-xs text-fg-muted">
              {e('messageReason', m.reason)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'by',
      header: t('colBy'),
      tabletHidden: true,
      sortValue: (m) => m.byName,
      cell: (m) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {m.byName}
        </span>
      ),
    },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <FilterBar canClear={filtered} onClear={() => url.clear()}>
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchOutbox')}
            aria-label={tc('search')}
            clearLabel={t('clearSearch')}
            className="w-full sm:w-80"
          />
          <Select
            size="sm"
            aria-label={t('filterChannel')}
            value={channel}
            onValueChange={(v) => url.set({ channel: v })}
            options={[
              { value: 'all' as const, label: t('channelAll') },
              ...MESSAGE_CHANNELS.map((c) => ({
                value: c,
                label: e('messageChannel', c),
              })),
            ]}
            className="w-full sm:w-40"
          />
          <Select
            size="sm"
            aria-label={t('filterState')}
            value={state}
            onValueChange={(v) => url.set({ state: v })}
            options={[
              { value: 'all' as const, label: t('stateAll') },
              ...MESSAGE_STATES.map((s) => ({
                value: s,
                label: e('messageState', s),
              })),
            ]}
            className="w-full sm:w-40"
          />
          <Select
            size="sm"
            aria-label={t('filterEvent')}
            value={event}
            onValueChange={(v) => url.set({ event: v })}
            options={[
              { value: 'all' as const, label: t('eventAll') },
              ...MESSAGE_EVENTS.map((ev) => ({
                value: ev,
                label: e('messageEvent', ev),
              })),
            ]}
            className="w-full sm:w-52"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('outboxTitle')}
            columns={columns}
            rows={rows}
            getRowId={(m) => m.id}
            rowLabel={(m) =>
              t('messageRowLabel', {
                event: e('messageEvent', m.event),
                recipient: m.to,
              })
            }
            onRowClick={(m) => setOpenId(m.id)}
            activeRowId={openId}
            isLoading={isPending}
            isError={isError}
            onRetry={onRetry}
            pageSize={25}
            initialSort={{ id: 'time', desc: true }}
            mobile={{
              primary: 'event',
              fields: ['time', 'channel', 'patient', 'state'],
            }}
            empty={
              <EmptyState
                icon={<InboxIcon />}
                tone="sky"
                title={
                  filtered ? t('outboxEmptyFiltered') : t('outboxEmptyTitle')
                }
                description={
                  filtered ? t('emptyFilteredBody') : t('outboxEmptyBody')
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
          onClose={closeOpen}
        />
      ) : null}
    </>
  )
}
