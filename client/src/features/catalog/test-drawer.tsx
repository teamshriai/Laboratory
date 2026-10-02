import { PencilIcon, PowerIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type CatalogTest } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { ContainerChip } from '@/components/lab/sample'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import {
  RESULT_TYPE_LABEL,
  sortRanges,
  useAgeBand,
  useCatalogTest,
} from './catalog-helpers'
import { RangeEditorDialog } from './range-editor'
import { TestFormDialog } from './test-form-dialog'

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-fg-muted">{label}</dt>
          <dd className="mt-0.5 text-meta text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Body({ test }: { test: CatalogTest }) {
  const t = useT('catalog')
  const e = useEnum()
  const f = useFormat()
  const age = useAgeBand()
  const [editing, setEditing] = useState<
    CatalogTest['analytes'][number] | null
  >(null)
  const none = <span className="text-fg-subtle">{t('notSpecified')}</span>
  return (
    <div className="grid gap-6 p-5">
      {test.description ? (
        <p className="text-sm text-fg">{test.description}</p>
      ) : null}
      <Section title={t('sectionBasic')}>
        <Facts
          items={[
            [
              t('fieldCode'),
              <span key="c" className="font-mono">
                {test.code}
              </span>,
            ],
            [t('fieldShortName'), test.shortName],
            [t('fieldDepartment'), e('department', test.department)],
            [t('fieldCategory'), test.category ?? none],
            [t('fieldMethod'), test.method ?? none],
            [t('fieldOrders30'), f.number(test.ordersLast30Days)],
          ]}
        />
      </Section>
      <Section title={t('sectionSpecimen')}>
        <Facts
          items={[
            [t('fieldSpecimen'), e('specimen', test.specimen)],
            [
              t('fieldContainer'),
              <ContainerChip key="ct" container={test.container} full />,
            ],
            [
              t('fieldVolume'),
              test.volumeMl
                ? t('volumeValue', { value: f.decimal(test.volumeMl) })
                : none,
            ],
            [
              t('fieldMinVolume'),
              test.minVolumeMl
                ? t('volumeValue', { value: f.decimal(test.minVolumeMl) })
                : none,
            ],
            [
              t('fieldStability'),
              test.stabilityHours
                ? t('stabilityValue', { value: test.stabilityHours })
                : none,
            ],
            [
              t('fieldStorage'),
              test.storage ? e('storage', test.storage) : none,
            ],
            [
              t('fieldFasting'),
              test.fasting ? t('fastingRequired') : t('fastingNotRequired'),
            ],
          ]}
        />
        {test.instructions.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {test.instructions.map((i) => (
              <Badge key={i} tone="info" size="sm">
                {e('instruction', i)}
              </Badge>
            ))}
          </ul>
        ) : null}
      </Section>
      <Section title={t('sectionProcessing')}>
        <Facts
          items={[
            [t('fieldTatRoutine'), f.hours(test.tatHours)],
            [t('fieldTatStat'), f.hours(test.statTatHours)],
          ]}
        />
      </Section>
      <Section
        title={`${t('sectionResult')} · ${t('parametersCount', { count: test.analytes.length })}`}
      >
        {test.analytes.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('noParameters')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {test.analytes.map((a) => {
              const ranges = sortRanges(a.ranges)
              const critical = [
                a.criticalLow !== undefined ? `< ${a.criticalLow}` : null,
                a.criticalHigh !== undefined ? `> ${a.criticalHigh}` : null,
              ]
                .filter(Boolean)
                .join(' / ')
              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-meta font-medium text-fg">
                        {a.name}{' '}
                        <span className="text-xs font-normal text-fg-muted">
                          {a.unit || t('noUnit')}
                        </span>
                      </p>
                      <p className="text-xs text-fg-muted">
                        {t(RESULT_TYPE_LABEL[a.resultType])}
                        {a.decimals !== undefined
                          ? ` · ${t('decimals', { count: a.decimals })}`
                          : ''}
                        {critical ? (
                          <span className="text-danger-text">
                            {' '}
                            · {t('criticalLimits', { value: critical })}
                          </span>
                        ) : null}
                        {a.criticalIfAbnormal ? (
                          <span className="text-danger-text">
                            {' '}
                            · {t('criticalIfAbnormal')}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {a.resultType === 'numeric' ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditing(a)}
                      >
                        <PencilIcon />
                        {t('editRanges')}
                      </Button>
                    ) : null}
                  </div>
                  {a.resultType === 'numeric' ? (
                    ranges.length ? (
                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          {ranges.map((r) => (
                            <tr key={r.id} className="border-t border-line/60">
                              <td className="py-1 pr-3 text-fg-muted">
                                {r.sex === 'any'
                                  ? t('sexAny')
                                  : e('sex', r.sex)}
                              </td>
                              <td className="py-1 pr-3 text-fg-muted">
                                {age(r)}
                              </td>
                              <td className="py-1 pr-3 text-fg-muted">
                                {r.specimen
                                  ? t('specimenOnly', {
                                      specimen: e('specimen', r.specimen),
                                    })
                                  : ''}
                              </td>
                              <td className="py-1 text-right font-medium text-fg tabular-nums">
                                {r.low ?? '<'}{' '}
                                {r.low !== null && r.high !== null ? '-' : ''}{' '}
                                {r.high ?? '>'} {a.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="mt-1.5 text-xs text-warning-text">
                        {t('noRanges')}
                      </p>
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-fg-subtle">{t('rangesSharedNote')}</p>
      </Section>
      <Section title={t('sectionBilling')}>
        <Facts
          items={[
            [
              t('fieldPricePrivate'),
              <span key="p" className="font-semibold tabular-nums">
                {f.currency(test.price)}
              </span>,
            ],
            [
              t('fieldPriceInsurance'),
              test.priceInsurance ? f.currency(test.priceInsurance) : none,
            ],
          ]}
        />
      </Section>
      {editing ? (
        <RangeEditorDialog
          analyte={editing}
          specimens={[test.specimen]}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

export function TestDrawer({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const t = useT('catalog')
  const e = useEnum()
  const { data, isPending, isError, refetch } = useCatalogTest(id)
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const toggle = useLabMutation(
    () => labApi.catalog.setActive(id, !data!.active, reason),
    {
      success: () =>
        data!.active
          ? {
              title: t('testDeactivated', { test: data!.name }),
              description: t('testDeactivatedBody'),
            }
          : {
              title: t('testActivated', { test: data!.name }),
              description: t('testActivatedBody'),
            },
      onSuccess: () => {
        setConfirm(false)
        setReason('')
      },
    },
  )
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={data?.name ?? t('title')}
      description={
        data
          ? t('drawerDescription', {
              code: data.code,
              department: e('department', data.department),
            })
          : undefined
      }
      headerExtra={
        data ? (
          <Badge tone={data.active ? 'success' : 'neutral'} size="sm">
            {data.active ? t('statusActive') : t('statusInactive')}
          </Badge>
        ) : null
      }
      footer={
        data ? (
          <div className="flex w-full justify-between gap-2">
            <Button
              variant="ghost"
              className={data.active ? 'text-danger-text' : ''}
              onClick={() => setConfirm(true)}
            >
              <PowerIcon />
              {data.active ? t('deactivate') : t('activate')}
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              <PencilIcon />
              {t('editTest')}
            </Button>
          </div>
        ) : null
      }
    >
      {isError ? (
        <ErrorState
          title={t('testNotFoundTitle')}
          onRetry={() => void refetch()}
        />
      ) : isPending || !data ? (
        <div className="grid gap-4 p-5">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Body test={data} />
      )}
      {data && confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(false)}
          title={
            data.active
              ? t('deactivateTitle', { test: data.name })
              : t('activateTitle', { test: data.name })
          }
          description={data.active ? t('deactivateBody') : t('activateBody')}
          confirmLabel={data.active ? t('deactivate') : t('activate')}
          {...(data.active ? { tone: 'danger' as const } : {})}
          loading={toggle.isPending}
          disabled={!reason.trim()}
          onConfirm={() => toggle.mutate(undefined)}
        >
          <Field label={t('changeReason')} required>
            <Input
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder={t('changeReasonPlaceholder')}
            />
          </Field>
        </ConfirmDialog>
      ) : null}
      {data && editing ? (
        <TestFormDialog test={data} onClose={() => setEditing(false)} />
      ) : null}
    </Drawer>
  )
}
