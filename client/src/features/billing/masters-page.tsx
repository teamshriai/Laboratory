import {
  BuildingIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  TagsIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { CreditAccount, PriceList, TestPackage } from '@/domain/types'
import { useSearchParam } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import type { BillingMasters } from '@/services/lab-api'
import { useBillingMasters, useOrderableTests } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Meter } from '@/components/ui/misc'
import { EmptyState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { MASTER_TABS, useMoney, type MasterTab } from './billing'
import {
  AccountDialog,
  PackageDialog,
  PriceListDialog,
} from './masters-dialogs'

type Account = BillingMasters['accounts'][number]
type Editing =
  | { kind: 'package'; item?: TestPackage }
  | { kind: 'account'; item?: CreditAccount }
  | { kind: 'price-list'; item?: PriceList }
  | null

function ActiveText({ active }: { active: boolean }) {
  const t = useT('billing')
  return active ? (
    <span className="inline-flex items-center gap-1 text-meta font-medium text-success-text">
      <CircleCheckIcon className="size-3.5" aria-hidden />
      {t('active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-meta text-fg-subtle">
      <CircleMinusIcon className="size-3.5" aria-hidden />
      {t('inactive')}
    </span>
  )
}

function EditButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const tc = useT('common')
  return (
    <GuardedButton
      permission="billing.manage"
      size="xs"
      aria-label={label}
      onClick={onClick}
    >
      <PencilIcon />
      {tc('edit')}
    </GuardedButton>
  )
}

export function Component() {
  const t = useT('billing')
  const e = useEnum()
  const money = useMoney()
  const [tab, setTab] = useSearchParam<MasterTab>(
    'tab',
    'packages',
    MASTER_TABS,
  )
  const { data, isPending, isError, refetch } = useBillingMasters()
  const { data: tests } = useOrderableTests()
  const [editing, setEditing] = useState<Editing>(null)
  const testName = (id: string) =>
    tests?.find((x) => x.id === id)?.shortName ?? id
  const priceListName = (id: string | undefined) =>
    id
      ? (data?.priceLists.find((p) => p.id === id)?.name ?? id)
      : t('catalogPrices')

  const packageColumns: Column<TestPackage>[] = [
    {
      id: 'name',
      header: t('name'),
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-meta font-medium text-fg">{p.name}</p>
          <p className="font-mono text-xs text-fg-muted">{p.code}</p>
        </div>
      ),
    },
    {
      id: 'tests',
      header: t('tests'),
      cell: (p) => (
        <div className="max-w-80 min-w-0">
          <p className="text-meta text-fg">
            {t('testCount', { count: p.testIds.length })}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {p.testIds.map(testName).join(', ')}
          </p>
        </div>
      ),
    },
    {
      id: 'price',
      header: t('packagePrice'),
      align: 'right',
      sortValue: (p) => p.price,
      cell: (p) => (
        <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
          {money(p.price)}
        </span>
      ),
    },
    {
      id: 'active',
      header: t('state'),
      cell: (p) => <ActiveText active={p.active} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (p) => (
        <EditButton
          label={t('editNamed', { name: p.name })}
          onClick={() => setEditing({ kind: 'package', item: p })}
        />
      ),
    },
  ]

  const accountColumns: Column<Account>[] = [
    {
      id: 'name',
      header: t('name'),
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="max-w-72 min-w-0">
          <p className="truncate text-meta font-medium text-fg">{a.name}</p>
          <p className="text-xs text-fg-muted">{e('accountKind', a.kind)}</p>
        </div>
      ),
    },
    {
      id: 'owed',
      header: t('owed'),
      sortValue: (a) => a.owed,
      cell: (a) => (
        <div className="grid w-44 gap-1">
          <span className="text-meta whitespace-nowrap text-fg tabular-nums">
            {t('owedOfLimit', {
              owed: money(a.owed),
              limit: money(a.creditLimit),
            })}
          </span>
          {a.creditLimit > 0 ? (
            <Meter
              value={Math.min(a.owed, a.creditLimit)}
              max={a.creditLimit}
              tone={a.owed >= a.creditLimit * 0.8 ? 'warning' : 'accent'}
            />
          ) : null}
        </div>
      ),
    },
    {
      id: 'priceList',
      header: t('priceList'),
      tabletHidden: true,
      cell: (a) => (
        <span className="block max-w-56 truncate text-meta text-fg-muted">
          {priceListName(a.priceListId)}
        </span>
      ),
    },
    {
      id: 'gstin',
      header: t('gstin'),
      tabletHidden: true,
      cell: (a) => (
        <span className="font-mono text-xs text-fg-muted">
          {a.gstin ?? '-'}
        </span>
      ),
    },
    {
      id: 'active',
      header: t('state'),
      cell: (a) => <ActiveText active={a.active} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (a) => (
        <EditButton
          label={t('editNamed', { name: a.name })}
          onClick={() => setEditing({ kind: 'account', item: a })}
        />
      ),
    },
  ]

  const priceListColumns: Column<PriceList>[] = [
    {
      id: 'name',
      header: t('name'),
      sortValue: (p) => p.name,
      cell: (p) => (
        <span className="text-meta font-medium text-fg">{p.name}</span>
      ),
    },
    {
      id: 'tests',
      header: t('tests'),
      sortValue: (p) => Object.keys(p.prices).length,
      cell: (p) => (
        <div className="max-w-80 min-w-0">
          <p className="text-meta text-fg">
            {t('testCount', { count: Object.keys(p.prices).length })}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {Object.keys(p.prices).map(testName).join(', ')}
          </p>
        </div>
      ),
    },
    {
      id: 'accounts',
      header: t('usedBy'),
      cell: (p) => (
        <span className="text-meta text-fg-muted">
          {t('accountCount', {
            count:
              data?.accounts.filter((a) => a.priceListId === p.id).length ?? 0,
          })}
        </span>
      ),
    },
    {
      id: 'active',
      header: t('state'),
      cell: (p) => <ActiveText active={p.active} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (p) => (
        <EditButton
          label={t('editNamed', { name: p.name })}
          onClick={() => setEditing({ kind: 'price-list', item: p })}
        />
      ),
    },
  ]

  const addLabel =
    tab === 'packages'
      ? t('newPackage')
      : tab === 'accounts'
        ? t('newAccount')
        : t('newPriceList')
  const add = () =>
    setEditing(
      tab === 'packages'
        ? { kind: 'package' }
        : tab === 'accounts'
          ? { kind: 'account' }
          : { kind: 'price-list' },
    )
  const table = {
    isLoading: isPending,
    isError,
    onRetry: () => void refetch(),
  }

  return (
    <>
      <PageHeader
        title={t('mastersTitle')}
        back={{ to: '/billing', label: t('backToBilling') }}
        meta={<span>{t('mastersMeta')}</span>}
        actions={
          <GuardedButton
            permission="billing.manage"
            variant="primary"
            onClick={add}
          >
            <PlusIcon strokeWidth={2.5} />
            {addLabel}
          </GuardedButton>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as MasterTab)}>
        <Card className="overflow-hidden">
          <div className="px-3 pt-1">
            <TabsList
              items={[
                {
                  value: 'packages',
                  label: t('tabPackages'),
                  icon: <PackageIcon />,
                  ...(data ? { count: data.packages.length } : {}),
                },
                {
                  value: 'accounts',
                  label: t('tabAccounts'),
                  icon: <BuildingIcon />,
                  ...(data ? { count: data.accounts.length } : {}),
                },
                {
                  value: 'price-lists',
                  label: t('tabPriceLists'),
                  icon: <TagsIcon />,
                  ...(data ? { count: data.priceLists.length } : {}),
                },
              ]}
            />
          </div>
          <TabsContent value="packages">
            <DataTable
              caption={t('tabPackages')}
              columns={packageColumns}
              rows={data?.packages}
              getRowId={(p) => p.id}
              pageSize={50}
              mobile={{
                primary: 'name',
                fields: ['price', 'tests', 'active'],
                actions: 'actions',
              }}
              {...table}
              empty={
                <EmptyState
                  icon={<PackageIcon />}
                  tone="green"
                  title={t('noPackages')}
                  description={t('noPackagesBody')}
                />
              }
            />
          </TabsContent>
          <TabsContent value="accounts">
            <DataTable
              caption={t('tabAccounts')}
              columns={accountColumns}
              rows={data?.accounts}
              getRowId={(a) => a.id}
              pageSize={50}
              mobile={{
                primary: 'name',
                fields: ['owed', 'active'],
                actions: 'actions',
              }}
              {...table}
              empty={
                <EmptyState
                  icon={<BuildingIcon />}
                  tone="green"
                  title={t('noAccounts')}
                  description={t('noAccountsBody')}
                />
              }
            />
          </TabsContent>
          <TabsContent value="price-lists">
            <DataTable
              caption={t('tabPriceLists')}
              columns={priceListColumns}
              rows={data?.priceLists}
              getRowId={(p) => p.id}
              pageSize={50}
              mobile={{
                primary: 'name',
                fields: ['tests', 'active'],
                actions: 'actions',
              }}
              {...table}
              empty={
                <EmptyState
                  icon={<TagsIcon />}
                  tone="green"
                  title={t('noPriceLists')}
                  description={t('noPriceListsBody')}
                />
              }
            />
          </TabsContent>
        </Card>
      </Tabs>

      {editing?.kind === 'package' ? (
        <PackageDialog pkg={editing.item} onClose={() => setEditing(null)} />
      ) : null}
      {editing?.kind === 'account' ? (
        <AccountDialog
          account={editing.item}
          priceLists={data?.priceLists ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === 'price-list' ? (
        <PriceListDialog list={editing.item} onClose={() => setEditing(null)} />
      ) : null}
    </>
  )
}
