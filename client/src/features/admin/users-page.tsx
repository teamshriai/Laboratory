import { CheckIcon, MinusIcon, ShieldIcon, UsersIcon } from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { usePreferences } from '@/app/preferences/context'
import { demo } from '@/services/lab-api'
import { PERMISSIONS, ROLE_PERMISSIONS } from '@/domain/permissions'
import { STAFF_ROLES, type Staff } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useReference } from '@/services/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/states'
import { focusWhenScrollable } from '@/lib/scroll-focus'
import { SignatoryRegistry } from './signatory-registry'

export function Component() {
  const t = useT('admin')
  const tc = useT('common')
  const e = useEnum()
  const { actorId, setActorId } = usePreferences()
  const { data, isPending, isError, refetch } = useReference()
  const staff = data?.staff.toSorted(
    (a, b) =>
      STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) ||
      a.name.localeCompare(b.name),
  )

  const columns: Column<Staff>[] = [
    {
      id: 'name',
      header: t('colName'),
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="text-meta font-medium text-fg">{s.name}</span>
      ),
    },
    {
      id: 'role',
      header: t('colRole'),
      sortValue: (s) => STAFF_ROLES.indexOf(s.role),
      cell: (s) => <Badge tone="neutral">{e('staffRole', s.role)}</Badge>,
    },
    {
      id: 'department',
      header: t('colDepartment'),
      cell: (s) => (
        <span className="text-meta text-fg-muted">
          {s.department ? e('department', s.department) : t('anyDepartment')}
        </span>
      ),
    },
    {
      id: 'qualification',
      header: t('colQualification'),
      tabletHidden: true,
      cell: (s) => (
        <span className="text-meta text-fg-muted">{s.qualification ?? ''}</span>
      ),
    },
    // "Act as" is the demo's stand-in for signing in.
    ...(demo.enabled
      ? ([
          {
            id: 'actions',
            header: <span className="sr-only">{tc('actions')}</span>,
            cell: (s) =>
              s.id === actorId ? (
                <Badge tone="accent">{t('actingNow')}</Badge>
              ) : (
                <Button size="xs" onClick={() => setActorId(s.id)}>
                  {t('actAs')}
                </Button>
              ),
          },
        ] satisfies Column<Staff>[])
      : []),
  ]

  return (
    <>
      <PageHeader
        title={t('usersTitle')}
        meta={
          staff ? <span>{t('usersMeta', { count: staff.length })}</span> : null
        }
      />
      <p className="mb-5 flex max-w-3xl items-start gap-2 rounded-lg bg-info-soft p-3 text-meta text-info-text">
        <ShieldIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('usersNote')}
      </p>
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader title={t('staff')} />
          <DataTable
            caption={t('staff')}
            columns={columns}
            rows={staff}
            getRowId={(s) => s.id}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            pageSize={50}
            mobile={{
              primary: 'name',
              fields: ['role', 'department'],
              actions: 'actions',
            }}
            empty={<EmptyState icon={<UsersIcon />} title={t('staff')} />}
          />
        </Card>
        <SignatoryRegistry />
        <Card>
          <CardHeader title={t('matrixTitle')} description={t('matrixHint')} />
          <div ref={focusWhenScrollable} className="focus-ring overflow-x-auto">
            <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-meta">
              <caption className="sr-only">{t('matrixTitle')}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 border-b border-line bg-surface-2 px-4 py-2 text-left text-xs font-semibold text-fg-muted"
                  >
                    {t('colPermission')}
                  </th>
                  {STAFF_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="border-b border-line bg-surface-2 px-2 py-2 text-center text-xs font-semibold text-fg-muted"
                    >
                      {e('staffRole', role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p}>
                    <th
                      scope="row"
                      className="sticky left-0 border-b border-line bg-surface px-4 py-1.5 text-left font-normal text-fg first-letter:uppercase"
                    >
                      {e('permission', p)}
                    </th>
                    {STAFF_ROLES.map((role) => {
                      const ok = ROLE_PERMISSIONS[role].includes(p)
                      return (
                        <td
                          key={role}
                          className="border-b border-line px-2 py-1.5 text-center"
                        >
                          {ok ? (
                            <CheckIcon
                              className="mx-auto size-4 text-success-text"
                              aria-label={t('allowed')}
                            />
                          ) : (
                            <MinusIcon
                              className="mx-auto size-4 text-fg-subtle"
                              aria-label={t('notAllowed')}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
