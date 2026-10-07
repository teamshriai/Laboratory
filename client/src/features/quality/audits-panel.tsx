import {
  CalendarPlusIcon,
  ClipboardCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { InternalAuditRow } from '@/services/lab-api'
import { useInternalAudits } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { PlanAuditDialog } from './records-audit-dialogs'
import { AuditDrawer } from './records-audit-drawer'
import { NotFoundDrawer } from '@/features/shared/not-found-drawer'
import { AUDIT_PARAM, useDepartmentLabel } from './records-shared'
import { AuditStateBadge, StatusText } from './records-ui'

const VIEWS = ['all', 'planned', 'in-progress', 'completed'] as const
type View = (typeof VIEWS)[number]

/** The internal audit schedule (ISO 15189 clause 8.8). */
export function AuditsPanel() {
  const t = useT('qualityRecords')
  const f = useFormat()
  const now = useNow()
  const dept = useDepartmentLabel()
  const [view, setView] = useSearchParam<View>('audits', 'all', VIEWS)
  const [openId, setOpenId, closeOpen] = useOverlayParam(AUDIT_PARAM)
  const [planning, setPlanning] = useState(false)
  const { data, isPending, isError, refetch } = useInternalAudits()
  const rows = data?.filter((a) => view === 'all' || a.state === view)
  const open = openId ? data?.find((a) => a.id === openId) : undefined
  const late = (a: InternalAuditRow) =>
    a.state === 'planned' && a.plannedFor < now

  const columns: Column<InternalAuditRow>[] = [
    {
      id: 'audit',
      header: t('colAudit'),
      sortValue: (a) => a.auditNo,
      cell: (a) => (
        <div className="max-w-80 min-w-0">
          <p className="font-mono text-meta font-semibold whitespace-nowrap text-fg">
            {a.auditNo}
          </p>
          <p className="truncate text-xs text-fg-muted">{a.area}</p>
        </div>
      ),
    },
    {
      id: 'clauses',
      header: t('clauses'),
      cell: (a) => (
        <span className="block max-w-40 truncate text-meta text-fg-muted tabular-nums">
          {a.clauses}
        </span>
      ),
    },
    {
      id: 'department',
      header: t('colDepartment'),
      sortValue: (a) => dept(a.department),
      cell: (a) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {dept(a.department)}
        </span>
      ),
    },
    {
      id: 'planned',
      header: t('plannedFor'),
      sortValue: (a) => a.plannedFor,
      cell: (a) => (
        <span className="grid justify-items-start gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {f.date(a.plannedFor)}
          </span>
          {late(a) ? (
            <StatusText icon={<TriangleAlertIcon />} tone="danger">
              {t('notStarted')}
            </StatusText>
          ) : null}
        </span>
      ),
    },
    {
      id: 'auditor',
      header: t('auditor'),
      tabletHidden: true,
      sortValue: (a) => a.auditorName,
      cell: (a) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {a.auditorName}
        </span>
      ),
    },
    {
      id: 'state',
      header: t('colState'),
      sortValue: (a) => a.state,
      cell: (a) => <AuditStateBadge state={a.state} />,
    },
    {
      id: 'findings',
      header: t('colFindings'),
      align: 'right',
      sortValue: (a) => a.findings.length,
      cell: (a) => {
        const ncs = a.findings.filter((x) => x.ncId).length
        return (
          <span className="grid justify-items-end gap-0.5">
            <span className="text-meta font-medium text-fg tabular-nums">
              {f.number(a.findings.length)}
            </span>
            {ncs ? (
              <span className="text-xs whitespace-nowrap text-danger-text">
                {t('ncShort', { count: ncs })}
              </span>
            ) : null}
          </span>
        )
      },
    },
  ]

  const count = (v: View) =>
    data?.filter((a) => v === 'all' || a.state === v).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-fg-muted">{t('auditsIntro')}</p>
        <GuardedButton
          permission="quality.manage"
          variant="primary"
          onClick={() => setPlanning(true)}
        >
          <CalendarPlusIcon />
          {t('planAudit')}
        </GuardedButton>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={view}
            onValueChange={(v) => setView(v)}
            aria-label={t('auditsTitle')}
            items={VIEWS.map((v) => ({
              value: v,
              label: v === 'all' ? t('docView.all') : t(`auditState.${v}`),
              count: count(v),
            }))}
          />
        </div>
        <DataTable
          caption={t('auditsTitle')}
          columns={columns}
          rows={rows}
          getRowId={(a) => a.id}
          rowLabel={(a) => `${a.auditNo} ${a.area}`}
          onRowClick={(a) => setOpenId(a.id)}
          activeRowId={open?.id ?? null}
          rowClassName={(a) => (late(a) ? 'row-alert' : undefined)}
          initialSort={{ id: 'planned', desc: true }}
          pageSize={50}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          mobile={{
            primary: 'audit',
            fields: ['planned', 'state', 'findings'],
          }}
          empty={
            <EmptyState
              icon={<ClipboardCheckIcon />}
              tone="violet"
              title={view === 'all' ? t('noAudits') : t('noAuditsView')}
              description={
                view === 'all' ? t('noAuditsBody') : t('noAuditsViewBody')
              }
              action={
                view === 'all' ? (
                  <GuardedButton
                    permission="quality.manage"
                    onClick={() => setPlanning(true)}
                  >
                    <CalendarPlusIcon />
                    {t('planAudit')}
                  </GuardedButton>
                ) : undefined
              }
            />
          }
        />
      </Card>

      {open ? (
        <AuditDrawer audit={open} onClose={closeOpen} />
      ) : openId && data ? (
        <NotFoundDrawer
          title={t('colAudit')}
          heading={t('auditNotFound')}
          body={t('recordNotFoundBody')}
          onClose={closeOpen}
        />
      ) : null}
      {planning ? (
        <PlanAuditDialog
          onClose={() => setPlanning(false)}
          onPlanned={(id) => {
            setPlanning(false)
            setOpenId(id)
          }}
        />
      ) : null}
    </div>
  )
}
