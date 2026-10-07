import {
  CircleCheckIcon,
  CircleMinusIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { SiteRow } from '@/services/lab-api'
import { useSites } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/states'
import { SiteDialog } from './site-dialog'

type Editing = { site?: SiteRow } | null

/** The main laboratory and its branches and collection points. */
export function SitesSection() {
  const t = useT('settings')
  const tc = useT('common')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useSites()
  const [editing, setEditing] = useState<Editing>(null)

  const columns: Column<SiteRow>[] = [
    {
      id: 'code',
      header: t('siteCode'),
      sortValue: (s) => s.code,
      cell: (s) => (
        <span className="font-mono text-meta font-medium text-fg">
          {s.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('siteName'),
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="block max-w-64 text-meta font-medium text-fg">
          {s.name}
        </span>
      ),
    },
    {
      id: 'kind',
      header: t('siteKind'),
      sortValue: (s) => s.kind,
      cell: (s) => (
        <span className="inline-flex items-center gap-1 text-meta whitespace-nowrap text-fg-muted">
          {s.kind === 'main' ? (
            <StarIcon className="size-3.5 shrink-0" aria-hidden />
          ) : null}
          {t(`siteKind.${s.kind}`)}
        </span>
      ),
    },
    {
      id: 'city',
      header: t('siteCity'),
      sortValue: (s) => s.city,
      cell: (s) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {s.city || '-'}
        </span>
      ),
    },
    {
      id: 'active',
      header: tc('status'),
      sortValue: (s) => Number(s.active),
      cell: (s) =>
        s.active ? (
          <span className="inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap text-success-text">
            <CircleCheckIcon className="size-3.5" aria-hidden />
            {t('siteActiveState')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-meta whitespace-nowrap text-fg-subtle">
            <CircleMinusIcon className="size-3.5" aria-hidden />
            {t('siteInactiveState')}
          </span>
        ),
    },
    {
      id: 'orders',
      header: t('siteOrders'),
      align: 'right',
      sortValue: (s) => s.orders30d,
      cell: (s) => (
        <span className="text-meta text-fg tabular-nums">
          {f.number(s.orders30d)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      cell: (s) => (
        <GuardedButton
          permission="settings.edit"
          size="xs"
          aria-label={t('editSiteNamed', { name: s.name })}
          onClick={() => setEditing({ site: s })}
        >
          <PencilIcon />
          {tc('edit')}
        </GuardedButton>
      ),
    },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl min-w-0 flex-1 basis-60 text-meta text-fg-muted">
          {t('sitesHint')}
        </p>
        <GuardedButton
          permission="settings.edit"
          variant="secondary"
          onClick={() => setEditing({})}
        >
          <PlusIcon strokeWidth={2.5} />
          {t('addSite')}
        </GuardedButton>
      </div>
      <div className="-mx-5 border-t border-line">
        <DataTable
          caption={t('sectionSites')}
          columns={columns}
          rows={data}
          getRowId={(s) => s.id}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          pageSize={50}
          mobile={{
            primary: 'name',
            fields: ['code', 'kind', 'city', 'active', 'orders'],
            actions: 'actions',
          }}
          empty={
            <EmptyState
              compact
              icon={<MapPinIcon />}
              tone="green"
              title={t('sitesEmpty')}
              description={t('sitesEmptyBody')}
            />
          }
        />
      </div>
      {editing ? (
        <SiteDialog site={editing.site} onClose={() => setEditing(null)} />
      ) : null}
    </>
  )
}
