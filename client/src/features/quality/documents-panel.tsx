import { CircleCheckIcon, FileTextIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { DocumentRow } from '@/services/lab-api'
import { useControlledDocuments } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { NewDocumentDialog } from './records-document-dialog'
import { DocumentDrawer, ReviewDue } from './records-document-drawer'
import { NotFoundDrawer } from '@/features/shared/not-found-drawer'
import { DOC_PARAM, documentState, useDepartmentLabel } from './records-shared'
import { DocumentStateBadge, StatusText } from './records-ui'

const VIEWS = ['all', 'in-review', 'draft', 'review-due', 'retired'] as const
type View = (typeof VIEWS)[number]

const inView = (d: DocumentRow, view: View) => {
  if (view === 'all') return true
  if (view === 'review-due') return d.reviewOverdue
  if (view === 'retired') return documentState(d) === 'retired'
  return d.pending?.state === view
}

/** The controlled document register (ISO 15189 clause 8.3). */
export function DocumentsPanel() {
  const t = useT('qualityRecords')
  const f = useFormat()
  const dept = useDepartmentLabel()
  const [view, setView] = useSearchParam<View>('docs', 'all', VIEWS)
  const [openId, setOpenId, closeOpen] = useOverlayParam(DOC_PARAM)
  const [creating, setCreating] = useState(false)
  const { data, isPending, isError, refetch } = useControlledDocuments()
  const rows = data?.filter((d) => inView(d, view))
  const open = openId ? data?.find((d) => d.id === openId) : undefined

  const columns: Column<DocumentRow>[] = [
    {
      id: 'document',
      header: t('colDocument'),
      sortValue: (d) => d.code,
      cell: (d) => (
        <div className="max-w-80 min-w-0">
          <p className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
            {d.code}
          </p>
          <p className="truncate text-xs text-fg-muted">{d.title}</p>
        </div>
      ),
    },
    {
      id: 'kind',
      header: t('kind'),
      sortValue: (d) => d.kind,
      cell: (d) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {t(`docKind.${d.kind}`)}
        </span>
      ),
    },
    {
      id: 'department',
      header: t('colDepartment'),
      tabletHidden: true,
      sortValue: (d) => dept(d.department),
      cell: (d) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {dept(d.department)}
        </span>
      ),
    },
    {
      id: 'inForce',
      header: t('colInForce'),
      cell: (d) =>
        d.current ? (
          <StatusText icon={<CircleCheckIcon />} tone="success">
            {t('versionShort', { version: d.current.version })}
          </StatusText>
        ) : (
          <span className="text-meta whitespace-nowrap text-fg-subtle">
            {documentState(d) === 'retired'
              ? t('docState.retired')
              : t('noneInForce')}
          </span>
        ),
    },
    {
      id: 'effective',
      header: t('colEffective'),
      sortValue: (d) => d.current?.effectiveFrom ?? null,
      cell: (d) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {d.current?.effectiveFrom ? f.date(d.current.effectiveFrom) : '-'}
        </span>
      ),
    },
    {
      id: 'reviewDue',
      header: t('colReviewDue'),
      sortValue: (d) => d.reviewDueAt,
      cell: (d) => <ReviewDue doc={d} />,
    },
    {
      id: 'pending',
      header: t('colPending'),
      sortValue: (d) => d.pending?.state ?? null,
      cell: (d) =>
        d.pending ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="text-meta font-medium text-fg tabular-nums">
              {t('versionShort', { version: d.pending.version })}
            </span>
            <DocumentStateBadge state={d.pending.state} />
          </span>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
  ]

  const count = (v: View) => data?.filter((d) => inView(d, v)).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-fg-muted">{t('documentsIntro')}</p>
        <GuardedButton
          permission="document.author"
          variant="primary"
          onClick={() => setCreating(true)}
        >
          <PlusIcon strokeWidth={2.5} />
          {t('newDocument')}
        </GuardedButton>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={view}
            onValueChange={(v) => setView(v)}
            aria-label={t('documentsTitle')}
            items={VIEWS.map((v) => ({
              value: v,
              label: t(`docView.${v}`),
              count: count(v),
              ...(v === 'review-due' && count(v)
                ? { tone: 'danger' as const }
                : {}),
            }))}
          />
        </div>
        <DataTable
          caption={t('documentsTitle')}
          columns={columns}
          rows={rows}
          getRowId={(d) => d.id}
          rowLabel={(d) => `${d.code} ${d.title}`}
          onRowClick={(d) => setOpenId(d.id)}
          activeRowId={open?.id ?? null}
          rowClassName={(d) => (d.reviewOverdue ? 'row-alert' : undefined)}
          initialSort={{ id: 'document' }}
          pageSize={50}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          mobile={{
            primary: 'document',
            fields: ['inForce', 'reviewDue', 'pending'],
          }}
          empty={
            <EmptyState
              icon={<FileTextIcon />}
              tone="indigo"
              title={view === 'all' ? t('noDocuments') : t('noDocumentsView')}
              description={
                view === 'all' ? t('noDocumentsBody') : t('noDocumentsViewBody')
              }
              action={
                view === 'all' ? (
                  <GuardedButton
                    permission="document.author"
                    onClick={() => setCreating(true)}
                  >
                    <PlusIcon />
                    {t('newDocument')}
                  </GuardedButton>
                ) : undefined
              }
            />
          }
        />
      </Card>

      {open ? (
        <DocumentDrawer doc={open} onClose={closeOpen} />
      ) : openId && data ? (
        <NotFoundDrawer
          title={t('colDocument')}
          heading={t('docNotFound')}
          body={t('recordNotFoundBody')}
          onClose={closeOpen}
        />
      ) : null}
      {creating ? (
        <NewDocumentDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setOpenId(id)
          }}
        />
      ) : null}
    </div>
  )
}
