import {
  CalendarCheckIcon,
  AwardIcon,
  CircleCheckIcon,
  EllipsisIcon,
  GaugeIcon,
  StickyNoteIcon,
  PlusIcon,
  OctagonAlertIcon,
  WrenchIcon,
  CircleXIcon,
  PlugIcon,
  UnplugIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DAY } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type EquipmentDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useEquipmentDetail } from '@/services/queries'
import {
  ConnectionBadge,
  EquipmentBadge,
  QcBadge,
} from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { Meter, Timeline, type TimelineEntry } from '@/components/ui/misc'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { EquipmentDialogs, type EquipmentDialogKind } from './equipment-dialogs'

function Fact({
  label,
  children,
  tone,
}: {
  label: string
  children: ReactNode
  tone?: 'danger' | 'warning'
}) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-meta font-medium',
          tone === 'danger'
            ? 'text-danger-text'
            : tone === 'warning'
              ? 'text-warning-text'
              : 'text-fg',
        )}
      >
        {children}
      </dd>
    </div>
  )
}

export function DueText({ at, now }: { at: number; now: number }) {
  const t = useT('equipment')
  const f = useFormat()
  const days = Math.floor((at - now) / DAY)
  return (
    <span
      className={cn(
        'tabular-nums',
        days < 0
          ? 'text-danger-text'
          : days <= 7
            ? 'text-warning-text'
            : 'text-fg',
      )}
    >
      {f.dateShort(at)}
      <span className="ml-1.5 text-xs font-normal">
        {days < 0
          ? t('overdueBy', { days: -days })
          : days === 0
            ? t('dueToday')
            : t('dueIn', { days })}
      </span>
    </span>
  )
}

const LOG_TONE: Record<string, TimelineEntry['tone']> = {
  maintenance: 'success',
  calibration: 'accent',
  breakdown: 'danger',
  'service-visit': 'accent',
  'status-change': 'warning',
  note: 'neutral',
}
const LOG_ICON: Record<string, ReactNode> = {
  maintenance: <WrenchIcon />,
  calibration: <AwardIcon />,
  breakdown: <OctagonAlertIcon />,
  'service-visit': <CalendarCheckIcon />,
  'status-change': <GaugeIcon />,
  note: <StickyNoteIcon />,
}

function Body({
  eq,
  onDialog,
}: {
  eq: EquipmentDetail
  onDialog: (k: EquipmentDialogKind, taskId?: string) => void
}) {
  const t = useT('equipment')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const duration = (min: number) =>
    min >= 60
      ? t('hoursMinutes', { h: Math.floor(min / 60), m: min % 60 })
      : t('minutes', { count: min })
  const scheduled = eq.maintenancePlan.filter((m) => m.status === 'scheduled')
  const done = eq.maintenancePlan
    .filter((m) => m.status === 'done')
    .toReversed()
  const maxUsage = Math.max(1, ...eq.usage.map((u) => u.tests))
  const calTone =
    eq.calibrationState === 'expired' || eq.calibrationState === 'failed'
      ? 'danger'
      : eq.calibrationState === 'due-soon'
        ? 'warning'
        : undefined
  return (
    <Tabs defaultValue="overview">
      <TabsList
        className="px-3"
        items={[
          { value: 'overview', label: t('tabOverview') },
          {
            value: 'maintenance',
            label: t('tabMaintenance'),
            count: scheduled.length,
          },
          { value: 'calibration', label: t('tabCalibration') },
          {
            value: 'qc',
            label: t('tabQc'),
            ...(eq.openQcEvents ? { count: eq.openQcEvents } : {}),
          },
          { value: 'usage', label: t('tabUsage') },
          { value: 'history', label: t('tabHistory') },
        ]}
      />
      <TabsContent value="overview" className="grid gap-5 p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-line p-4">
          <Fact label={t('currentStatus')}>
            <EquipmentBadge status={eq.effectiveStatus} size="sm" />
          </Fact>
          <Fact label={t('department')}>{e('department', eq.department)}</Fact>
          <Fact label={t('manufacturer')}>{eq.manufacturer}</Fact>
          <Fact label={t('model')}>
            {eq.model}{' '}
            <span className="font-mono text-xs text-fg-muted">
              {t('serial', { serial: eq.serialNo })}
            </span>
          </Fact>
          <Fact label={t('serviceProvider')}>{eq.serviceProvider ?? '-'}</Fact>
          <Fact label={t('location')}>{eq.location}</Fact>
          <Fact label={t('lastMaintenance')}>
            {f.dateShort(eq.lastMaintenanceAt)}
          </Fact>
          <Fact label={t('nextMaintenance')}>
            <DueText at={eq.nextMaintenanceAt} now={now} />
          </Fact>
          <Fact label={t('lastCalibration')}>
            {f.dateShort(eq.lastCalibrationAt)}
          </Fact>
          <Fact
            label={t('nextCalibration')}
            {...(calTone ? { tone: calTone } : {})}
          >
            <DueText at={eq.calibrationDueAt} now={now} />
          </Fact>
          <Fact label={t('capacity')}>
            {t('perHour', { count: eq.capacityPerHour })}
          </Fact>
          <Fact label={t('downtime30')}>{duration(eq.downtimeMin30d)}</Fact>
        </dl>
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between text-meta">
            <span className="text-fg-muted">{t('utilization')}</span>
            <span className="font-semibold text-fg tabular-nums">
              {f.percent(eq.utilizationPct / 100)}
            </span>
          </div>
          <Meter value={eq.utilizationPct} max={100} className="mt-2" />
          <p className="mt-2 text-xs text-fg-muted">
            {t('testsToday', { count: eq.testsToday })}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="maintenance" className="grid gap-5 p-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              {t('scheduled')}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDialog('schedule')}
            >
              <PlusIcon />
              {t('schedule')}
            </Button>
          </div>
          {scheduled.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-meta text-fg-muted">
              {t('noScheduled')}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {scheduled.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-meta font-medium text-fg">{m.title}</p>
                    <p className="text-xs text-fg-muted">
                      {e('maintenanceKind', m.kind)} · {m.assignee}
                    </p>
                  </div>
                  <span className="text-meta">
                    <DueText at={m.dueAt} now={now} />
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onDialog('complete', m.id)}
                  >
                    <CircleCheckIcon />
                    {t('complete')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
            {t('completed')}
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {eq.log
              .filter((l) => l.type === 'maintenance')
              .map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-meta text-fg">{l.note}</p>
                    <span className="shrink-0 text-xs text-fg-muted">
                      {f.dateShort(l.at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {l.performedBy ?? l.byName}
                    {l.downtimeMin ? ` · ${duration(l.downtimeMin)}` : ''}
                  </p>
                </li>
              ))}
            {done.length === 0 &&
            !eq.log.some((l) => l.type === 'maintenance') ? (
              <li className="px-4 py-3 text-meta text-fg-muted">-</li>
            ) : null}
          </ul>
        </section>
      </TabsContent>

      <TabsContent value="calibration" className="grid gap-4 p-5">
        <div className="flex items-center justify-between rounded-xl border border-line p-4">
          <div>
            <p className="text-xs text-fg-muted">{t('calibrationStatus')}</p>
            <p
              className={cn(
                'mt-0.5 text-sm font-semibold',
                calTone === 'danger'
                  ? 'text-danger-text'
                  : calTone === 'warning'
                    ? 'text-warning-text'
                    : 'text-success-text',
              )}
            >
              {e('calibrationState', eq.calibrationState)}
            </p>
            <p className="text-xs text-fg-muted">
              {t('nextCalibration')}:{' '}
              <DueText at={eq.calibrationDueAt} now={now} />
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDialog('calibration')}
          >
            <AwardIcon />
            {t('recordCalibration')}
          </Button>
        </div>
        {eq.calibrations.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('noCalibrations')}</p>
        ) : (
          <table className="w-full text-meta">
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th className="py-2 font-medium">{t('performedAt')}</th>
                <th className="py-2 font-medium">{t('certificate')}</th>
                <th className="py-2 font-medium">{t('result')}</th>
                <th className="py-2 font-medium">{t('performedBy')}</th>
                <th className="py-2 font-medium">{t('nextDueDate')}</th>
              </tr>
            </thead>
            <tbody>
              {eq.calibrations.map((c) => (
                <tr key={c.id} className="border-b border-line/70">
                  <td className="py-2.5 whitespace-nowrap">
                    {f.dateShort(c.at)}
                  </td>
                  <td className="py-2.5 font-mono text-xs">
                    {c.certificateNo}
                  </td>
                  <td className="py-2.5">
                    {c.result === 'pass' ? (
                      <span className="inline-flex items-center gap-1 text-success-text">
                        <CircleCheckIcon strokeWidth={2.2} />
                        {t('calPass')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger-text">
                        <CircleXIcon strokeWidth={2.2} />
                        {t('calFail')}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-fg-muted">{c.byName}</td>
                  <td className="py-2.5 whitespace-nowrap text-fg-muted">
                    {c.result === 'pass' ? f.dateShort(c.nextDueAt) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      <TabsContent value="qc" className="grid gap-3 p-5">
        {eq.qcEvents
          .filter((ev) => ev.status !== 'resolved')
          .map((ev) => (
            <Link
              key={ev.id}
              to={`/quality-control?event=${ev.id}`}
              className="flex items-center gap-3 rounded-xl border border-danger/35 bg-danger-soft/40 px-4 py-3 hover:bg-danger-soft/70"
            >
              <CircleXIcon strokeWidth={2.2} className="size-5 text-danger" />
              <span className="min-w-0 flex-1 text-meta">
                <span className="font-medium text-fg">
                  {ev.analyteName} {ev.level}
                </span>
                <span className="text-fg-muted">
                  {' '}
                  · {f.dateTime(ev.openedAt)}
                </span>
              </span>
              <span className="text-xs font-medium text-danger-text">
                {t('openQc', { count: 1 })}
              </span>
            </Link>
          ))}
        {eq.qcRuns.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('noQc')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {eq.qcRuns.slice(0, 15).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-2.5 text-meta"
              >
                <span className="min-w-0 flex-1 truncate text-fg">
                  {r.analyteName}{' '}
                  <span className="text-xs text-fg-muted">{r.level}</span>
                </span>
                <span className="text-fg-muted tabular-nums">{r.value}</span>
                <span className="w-28 text-right text-xs text-fg-muted">
                  {f.dateShort(r.at)}
                </span>
                <QcBadge result={r.result} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="usage" className="p-5">
        <h3 className="mb-1 text-sm font-semibold text-fg">
          {t('usageTitle')}
        </h3>
        <p className="mb-4 text-xs text-fg-muted">
          {t('usageTotal', {
            count: eq.usage.reduce((n, u) => n + u.tests, 0),
          })}
        </p>
        <div
          className="flex h-40 items-end gap-3"
          role="img"
          aria-label={eq.usage.map((u) => `${u.day}: ${u.tests}`).join(', ')}
        >
          {eq.usage.map((u, i) => (
            <div
              key={u.day}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-2xs text-fg-muted tabular-nums">
                {u.tests}
              </span>
              <span
                className={cn(
                  'w-full max-w-10 rounded-t-sm',
                  i === eq.usage.length - 1 ? 'bg-chart-1' : 'bg-chart-1/45',
                )}
                style={{
                  height: `${Math.max(2, (u.tests / maxUsage) * 100)}%`,
                }}
              />
              <span className="text-2xs text-fg-subtle">
                {f.weekday(Date.parse(`${u.day}T12:00:00+05:30`))}
              </span>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="history" className="p-5">
        <Timeline
          items={eq.log.map((l) => ({
            id: l.id,
            icon: LOG_ICON[l.type],
            tone: LOG_TONE[l.type] ?? 'neutral',
            title: (
              <>
                <span className="font-medium">{e('equipmentLog', l.type)}</span>
                {l.status ? (
                  <span className="text-fg-muted">
                    {' '}
                    · {e('equipmentStatus', l.status)}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-meta text-fg-muted">
                  {l.note}
                </span>
              </>
            ),
            meta: `${f.dateTime(l.at)} · ${l.performedBy ?? l.byName}${l.downtimeMin ? ` · ${duration(l.downtimeMin)}` : ''}`,
          }))}
        />
      </TabsContent>
    </Tabs>
  )
}

/** Taking an analyzer offline stops new work reaching it; a reason is kept. */
function ConnectionDialog({
  eq,
  onClose,
}: {
  eq: {
    id: string
    name: string
    connection?: 'online' | 'offline'
    runningSamples: number
  }
  onClose: () => void
}) {
  const t = useT('equipment')
  const tc = useT('common')
  const [reason, setReason] = useState('')
  const next = eq.connection === 'offline' ? 'online' : 'offline'
  const save = useLabMutation(
    () => labApi.equipment.setConnection(eq.id, { connection: next, reason }),
    {
      success: () =>
        next === 'offline'
          ? t('offlineToast', { name: eq.name })
          : t('onlineToast', { name: eq.name }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      title={
        next === 'offline'
          ? t('takeOfflineTitle', { name: eq.name })
          : t('bringOnlineTitle', { name: eq.name })
      }
      description={
        next === 'offline'
          ? t('takeOfflineBody', { count: eq.runningSamples })
          : t('bringOnlineBody')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant={next === 'offline' ? 'danger' : 'primary'}
            disabled={!reason.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {next === 'offline' ? t('takeOffline') : t('bringOnline')}
          </Button>
        </>
      }
    >
      <Field label={t('connectionReason')} required>
        <Textarea
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
          rows={3}
          autoFocus
          placeholder={
            next === 'offline'
              ? t('offlinePlaceholder')
              : t('onlinePlaceholder')
          }
        />
      </Field>
    </Dialog>
  )
}

export function EquipmentDrawer({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const t = useT('equipment')
  const { data, isPending, isError, refetch } = useEquipmentDetail(id)
  const [dialog, setDialog] = useState<{
    kind: EquipmentDialogKind
    taskId?: string
  } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const open = (kind: EquipmentDialogKind, taskId?: string) =>
    setDialog(taskId ? { kind, taskId } : { kind })
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={data?.name ?? t('title')}
      description={
        data
          ? `${data.manufacturer} ${data.model} · ${data.location}`
          : undefined
      }
      headerExtra={
        data ? (
          <>
            <EquipmentBadge status={data.effectiveStatus} size="sm" />
            <ConnectionBadge connection={data.connection} size="sm" />
          </>
        ) : null
      }
      footer={
        data ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost">
                  <EllipsisIcon strokeWidth={2.5} />
                  {t('moreActions')}
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  icon={<CalendarCheckIcon />}
                  onSelect={() => open('service')}
                >
                  {t('recordService')}
                </MenuItem>
                <MenuItem
                  icon={<StickyNoteIcon />}
                  onSelect={() => open('note')}
                >
                  {t('addNote')}
                </MenuItem>
                <MenuItem
                  icon={
                    data.connection === 'offline' ? (
                      <PlugIcon />
                    ) : (
                      <UnplugIcon />
                    )
                  }
                  onSelect={() => setConnecting(true)}
                >
                  {data.connection === 'offline'
                    ? t('bringOnline')
                    : t('takeOffline')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<OctagonAlertIcon />}
                  danger
                  onSelect={() => open('breakdown')}
                >
                  {t('reportBreakdown')}
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button variant="secondary" onClick={() => open('calibration')}>
              <AwardIcon />
              {t('recordCalibration')}
            </Button>
            <Button variant="primary" onClick={() => open('complete')}>
              <WrenchIcon />
              {t('complete')}
            </Button>
          </div>
        ) : null
      }
    >
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isPending || !data ? (
        <div className="grid gap-4 p-5">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Body eq={data} onDialog={open} />
      )}
      {data && connecting ? (
        <ConnectionDialog eq={data} onClose={() => setConnecting(false)} />
      ) : null}
      {data ? (
        <EquipmentDialogs
          eq={data}
          kind={dialog?.kind ?? null}
          taskId={dialog?.taskId}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Drawer>
  )
}
