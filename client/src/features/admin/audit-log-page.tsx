import { ArrowRightIcon, ScrollTextIcon } from 'lucide-react'
import { useDeferredValue } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { AUDIT_ENTITIES, type AuditEntity } from '@/domain/types'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useTablePaging } from '@/hooks/use-table-paging'
import { useEnum, useT } from '@/i18n/context'
import type { EnumGroup, TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import {
  labApi,
  type AuditFilters,
  type AuditRow,
  type DatePreset,
} from '@/services/lab-api'
import { useAuditLog, useReference } from '@/services/queries'
import { FilterBar } from '@/components/lab/filter-bar'
import { ExportButton } from '@/components/lab/export-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'

const DATES = ['today', 'yesterday', '7d', '30d', 'all'] as const

export function Component() {
  const t = useT('admin')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const { data: reference } = useReference()
  const url = useUrlFilters(
    { q: '', entity: 'all', date: '7d', by: 'all', action: 'all' },
    { entity: ['all', ...AUDIT_ENTITIES], date: DATES },
  )
  const q = useDeferredValue(url.values.q)
  const entity = url.values.entity as AuditEntity | 'all'
  const paging = useTablePaging(50, ['time', 'action', 'user'])
  const listFilters: AuditFilters = {
    q,
    date: url.values.date as DatePreset,
    ...(entity !== 'all' ? { entity } : {}),
    ...(url.values.by !== 'all' ? { by: url.values.by } : {}),
    ...(url.values.action !== 'all' ? { action: url.values.action } : {}),
  }
  const { data, isPending, isError, refetch } = useAuditLog({
    ...listFilters,
    ...paging.query,
  })

  const actionLabel = (action: string) => {
    const label = t(`action.${action}` as TKey<'admin'>)
    return label.startsWith('action.')
      ? action.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase())
      : label
  }
  // Status values are shown in words, in the reader's language.
  const STATUS_GROUP: Partial<Record<AuditEntity, EnumGroup>> = {
    sample: 'sampleStatus',
    result: 'resultStatus',
    report: 'reportStatus',
    critical: 'criticalStatus',
  }
  const value = (r: AuditRow, v: string | undefined) => {
    if (!v) return ''
    const group = STATUS_GROUP[r.entity]
    const key = r.entity === 'report' && v === 'final' ? 'released' : v
    if (!group) return v
    const label = e(group, key as never)
    return label.startsWith(`${group}.`) ? v : label
  }
  const recordLabel = (r: AuditRow) =>
    r.record.label ||
    (r.entity === 'settings' ? t('labSettings') : t('demoData'))
  const change = (r: AuditRow) =>
    r.from || r.to
      ? `${value(r, r.from)}${r.from && r.to ? ' -> ' : ''}${value(r, r.to)}`
      : ''

  const columns: Column<AuditRow>[] = [
    {
      id: 'time',
      header: t('colTime'),
      sortable: true,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {f.dateTime(r.at)}
        </span>
      ),
    },
    {
      id: 'record',
      header: t('colRecord'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-xs text-fg-subtle">
            {t(`entity.${r.entity}`)}
          </span>
          {r.record.link ? (
            <Link
              to={r.record.link}
              className="max-w-64 truncate py-0.5 text-meta font-medium text-fg hover:text-accent-text hover:underline"
            >
              {recordLabel(r)}
            </Link>
          ) : (
            <span className="text-meta font-medium text-fg">
              {recordLabel(r)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'action',
      header: t('colAction'),
      sortable: true,
      cell: (r) => (
        <span className="text-meta font-medium text-fg">
          {actionLabel(r.action)}
        </span>
      ),
    },
    {
      id: 'change',
      header: t('colChange'),
      cell: (r) =>
        r.from || r.to ? (
          <span className="flex max-w-72 flex-wrap items-center gap-1 text-meta">
            {r.from ? (
              <span className="text-fg-subtle line-through">
                {value(r, r.from)}
              </span>
            ) : null}
            {r.from && r.to ? (
              <>
                <ArrowRightIcon
                  className="size-3 shrink-0 text-fg-subtle"
                  aria-hidden
                />
                <span className="sr-only">{t('changedTo')}</span>
              </>
            ) : null}
            {r.to ? <span className="text-fg">{value(r, r.to)}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-fg-subtle">
            {Object.values(r.detail ?? {}).join(' · ')}
          </span>
        ),
    },
    {
      id: 'reason',
      header: t('colReason'),
      tabletHidden: true,
      cell: (r) => (
        <span className="block max-w-72 text-meta text-fg-muted">
          {r.reason ?? ''}
        </span>
      ),
    },
    {
      id: 'user',
      header: t('colUser'),
      sortable: true,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg">{r.byName}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('auditTitle')}
        meta={
          data ? <span>{t('auditMeta', { count: data.total })}</span> : null
        }
        actions={
          <ExportButton
            filename={t('exportFile')}
            entity="system"
            disabled={!data?.rows.length}
            rows={async () => [
              [
                t('colTime'),
                t('colUser'),
                t('entity'),
                t('colRecord'),
                t('colAction'),
                t('colChange'),
                t('colReason'),
              ],
              // Every matching entry, not just the page on screen.
              ...(await labApi.admin.audit(listFilters)).rows.map((r) => [
                f.dateTime(r.at),
                r.byName,
                t(`entity.${r.entity}`),
                recordLabel(r),
                actionLabel(r.action),
                change(r),
                r.reason,
              ]),
            ]}
          />
        }
      />
      <p className="mb-4 max-w-3xl text-meta text-fg-muted">{t('auditNote')}</p>
      <Card className="overflow-hidden">
        <FilterBar
          chips={[
            ...(url.values.by !== 'all'
              ? [
                  {
                    key: 'by',
                    label: `${t('user')}: ${reference?.staff.find((s) => s.id === url.values.by)?.name ?? url.values.by}`,
                    onRemove: () => url.set({ by: 'all' }),
                  },
                ]
              : []),
            ...(url.values.action !== 'all'
              ? [
                  {
                    key: 'action',
                    label: `${t('action')}: ${actionLabel(url.values.action)}`,
                    onRemove: () => url.set({ action: 'all' }),
                  },
                ]
              : []),
          ]}
          onClear={() => url.clear()}
          canClear={url.activeCount() > 0}
          moreCount={url.activeCount(['by', 'action'])}
          more={
            <div className="grid gap-3">
              <Select
                aria-label={t('user')}
                value={url.values.by}
                onValueChange={(v) => url.set({ by: v })}
                options={[
                  { value: 'all', label: t('anyUser') },
                  ...(reference?.staff ?? [])
                    .toSorted((a, b) => a.name.localeCompare(b.name))
                    .map((s) => ({
                      value: s.id,
                      label: s.name,
                      description: e('staffRole', s.role),
                    })),
                ]}
              />
              <Select
                aria-label={t('action')}
                value={url.values.action}
                onValueChange={(v) => url.set({ action: v })}
                options={[
                  { value: 'all', label: t('anyAction') },
                  ...(data?.actions ?? []).map((a) => ({
                    value: a,
                    label: actionLabel(a),
                  })),
                ]}
              />
            </div>
          }
        >
          <SearchInput
            value={url.values.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="w-full sm:w-80"
          />
          <Select
            size="sm"
            className="w-44"
            aria-label={t('entity')}
            value={entity}
            onValueChange={(v) => url.set({ entity: v })}
            options={[
              { value: 'all' as const, label: t('anyEntity') },
              ...AUDIT_ENTITIES.map((x) => ({
                value: x,
                label: t(`entity.${x}`),
              })),
            ]}
          />
          <Select
            size="sm"
            className="w-36"
            aria-label={tc('date')}
            value={url.values.date as DatePreset}
            onValueChange={(v) => url.set({ date: v })}
            options={DATES.map((d) => ({
              value: d,
              label: e('datePreset', d),
            }))}
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('auditTitle')}
            columns={columns}
            rows={data?.rows}
            server={paging.table(data?.page)}
            getRowId={(r) => r.id}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            mobile={{ primary: 'action', fields: ['record', 'time', 'user'] }}
            empty={
              <EmptyState
                icon={<ScrollTextIcon />}
                title={t('emptyTitle')}
                description={t('emptyBody')}
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
