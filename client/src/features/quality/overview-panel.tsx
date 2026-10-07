import {
  AwardIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  DatabaseZapIcon,
  GaugeIcon,
  LandmarkIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { DAY } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { QualityIndicator, QualityOverview } from '@/services/lab-api'
import { useQualityOverview } from '@/services/queries'
import { TrendLine } from '@/components/charts/micro'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { MetricStrip } from '@/components/ui/metric-strip'
import { CardSkeleton, KpiSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { OverdueText } from './quality-badges'

const STATUS = {
  met: { icon: CircleCheckIcon, className: 'text-success-text' },
  missed: { icon: CircleXIcon, className: 'text-danger-text' },
  'no-data': { icon: CircleMinusIcon, className: 'text-fg-subtle' },
} as const

function IndicatorCard({ indicator }: { indicator: QualityIndicator }) {
  const t = useT('quality')
  const f = useFormat()
  const { icon: Icon, className } = STATUS[indicator.status]
  const key = indicator.key
  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{t(`ind.${key}`)}</h3>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 text-xs font-semibold',
            className,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {t(`indStatus.${indicator.status}`)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-fg-subtle">{t(`indHint.${key}`)}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xl leading-none font-semibold tracking-tight text-fg tabular-nums">
            {indicator.value === null ? '-' : f.percent(indicator.value / 100)}
          </p>
          <p className="mt-1.5 text-xs text-fg-muted">
            {t(indicator.higherIsBetter ? 'targetAtLeast' : 'targetAtMost', {
              target: f.percent(indicator.target / 100),
            })}
          </p>
        </div>
        {indicator.trend.length >= 2 ? (
          <div className="w-24 shrink-0 text-chart-1">
            <TrendLine values={indicator.trend} height={32} />
            <p className="mt-1 text-right text-2xs text-fg-subtle">
              {t('trendWeeks', { n: indicator.trend.length })}
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-3 border-t border-line pt-2.5 text-xs text-fg-muted tabular-nums">
        {indicator.denominator > 0
          ? t(`indRatio.${key}`, {
              n: f.number(indicator.numerator),
              d: f.number(indicator.denominator),
            })
          : t('indNoData')}
      </p>
    </Card>
  )
}

function Fact({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="min-w-0">
      <CardHeader title={title} icon={icon} tone="amber" titleAs="h3" />
      <CardBody className="grid gap-2 text-sm">{children}</CardBody>
    </Card>
  )
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-meta text-fg-muted">{label}</dt>
      <dd className="text-meta font-medium text-fg tabular-nums">{children}</dd>
    </div>
  )
}

function Compliance({ data }: { data: QualityOverview }) {
  const t = useT('quality')
  const f = useFormat()
  const now = useNow()
  const lis = data.lisVerification
  const reg = data.registration
  const lisOverdue = lis.nextDueAt !== null && lis.nextDueAt < now
  const daysLeft = Math.floor((reg.validTo - now) / DAY)
  return (
    <section aria-labelledby="q-compliance" className="grid gap-3">
      <h2 id="q-compliance" className="text-sm font-semibold text-fg">
        {t('complianceTitle')}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Fact icon={<DatabaseZapIcon />} title={t('lisTitle')}>
          <dl className="grid gap-2">
            <Row label={t('lisLast')}>
              {lis.lastAt ? f.date(lis.lastAt) : t('lisNever')}
            </Row>
            <Row label={t('lisNext')}>
              {lis.nextDueAt ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {f.date(lis.nextDueAt)}
                  {lisOverdue ? <OverdueText /> : null}
                </span>
              ) : (
                t('lisNow')
              )}
            </Row>
          </dl>
          <p className="text-xs text-fg-subtle">{t('lisHint')}</p>
          <Link
            to="/quality?tab=lis"
            className="focus-ring inline-flex min-h-11 items-center self-start rounded-lg text-meta font-medium text-accent-text hover:underline"
          >
            {t('openLis')}
          </Link>
        </Fact>
        <Fact icon={<LandmarkIcon />} title={t('registrationTitle')}>
          <dl className="grid gap-2">
            <Row label={t('validTo')}>
              {reg.validTo ? f.date(reg.validTo) : t('notRecorded')}
            </Row>
            <Row label={t('regState')}>
              <RegistrationState state={reg.state} />
            </Row>
          </dl>
          {reg.state === 'renew-now' || reg.state === 'expired' ? (
            <div
              role="status"
              className={cn(
                'flex gap-2 rounded-lg border p-3 text-meta',
                reg.state === 'expired'
                  ? 'border-danger-text/25 bg-danger-soft text-danger-text'
                  : 'border-warning-text/25 bg-warning-soft text-warning-text',
              )}
            >
              <TriangleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <p>
                {reg.state === 'expired'
                  ? t('regExpired', { days: f.number(Math.abs(daysLeft)) })
                  : t('regRenew', { days: f.number(Math.max(0, daysLeft)) })}
              </p>
            </div>
          ) : null}
          {reg.state === 'renew-now' || reg.state === 'expired' ? null : (
            <p className="text-xs text-fg-subtle">{t('regHint')}</p>
          )}
        </Fact>
        <Fact icon={<AwardIcon />} title={t('nablTitle')}>
          <dl className="grid gap-2">
            <Row label={t('validTo')}>
              {reg.nablValidTo ? f.date(reg.nablValidTo) : t('notRecorded')}
            </Row>
            {reg.nablValidTo ? (
              <Row label={t('nablLeft')}>
                {reg.nablValidTo < now ? (
                  <OverdueText label={t('nablLapsed')} />
                ) : (
                  t('daysLeft', {
                    days: f.number(Math.floor((reg.nablValidTo - now) / DAY)),
                  })
                )}
              </Row>
            ) : null}
          </dl>
          <p className="text-xs text-fg-subtle">{t('nablHint')}</p>
        </Fact>
      </div>
    </section>
  )
}

function RegistrationState({
  state,
}: {
  state: QualityOverview['registration']['state']
}) {
  const t = useT('quality')
  if (state === 'valid')
    return (
      <Badge tone="success" size="sm">
        <CircleCheckIcon aria-hidden />
        {t('regValid')}
      </Badge>
    )
  if (state === 'renew-now')
    return (
      <Badge tone="warning" size="sm">
        <CalendarClockIcon aria-hidden />
        {t('regRenewNow')}
      </Badge>
    )
  if (state === 'expired')
    return (
      <Badge tone="danger" size="sm">
        <CircleXIcon aria-hidden />
        {t('regExpiredState')}
      </Badge>
    )
  return (
    <Badge tone="neutral" size="sm">
      <CircleMinusIcon aria-hidden />
      {t('notRecorded')}
    </Badge>
  )
}

export function OverviewPanel() {
  const t = useT('quality')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useQualityOverview()

  if (isPending)
    return (
      <div className="grid gap-6" role="status" aria-busy>
        <span className="sr-only">{t('loading')}</span>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      </div>
    )
  if (isError)
    return (
      <Card>
        <ErrorState onRetry={() => void refetch()} />
      </Card>
    )

  const c = data.counts
  return (
    <div className="grid gap-6">
      <section aria-labelledby="q-indicators" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="q-indicators"
            className="inline-flex items-center gap-2 text-sm font-semibold text-fg"
          >
            <GaugeIcon className="size-4 text-fg-subtle" aria-hidden />
            {t('indicatorsTitle')}
          </h2>
          <p className="text-xs text-fg-subtle">
            {t('indicatorsPeriod', {
              from: f.date(data.from),
              to: f.date(data.to),
            })}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.indicators.map((i) => (
            <IndicatorCard key={i.key} indicator={i} />
          ))}
        </div>
      </section>

      <section aria-labelledby="q-work" className="grid gap-3">
        <h2 id="q-work" className="text-sm font-semibold text-fg">
          {t('workTitle')}
        </h2>
        <MetricStrip
          items={[
            {
              key: 'ncOpen',
              label: t('countNcOpen'),
              value: f.number(c.ncOpen),
              href: '/quality?tab=capa',
            },
            {
              key: 'ncOverdue',
              label: t('countNcOverdue'),
              value: f.number(c.ncOverdue),
              href: '/quality?tab=capa',
              alert: c.ncOverdue > 0,
            },
            {
              key: 'eqaPending',
              label: t('countEqaPending'),
              value: f.number(c.eqaPending),
              href: '/quality?tab=eqa',
            },
            {
              key: 'risksHigh',
              label: t('countRisksHigh'),
              value: f.number(c.risksHigh),
              href: '/quality?tab=risks',
              alert: c.risksHigh > 0,
            },
          ]}
        />
        <MetricStrip
          items={[
            {
              key: 'docsReview',
              label: t('countDocsInReview'),
              value: f.number(c.documentsInReview),
              href: '/quality?tab=documents',
            },
            {
              key: 'docsDue',
              label: t('countDocsReviewDue'),
              value: f.number(c.documentsReviewDue),
              detail: t('within30Days'),
              href: '/quality?tab=documents',
            },
            {
              key: 'audits',
              label: t('countAuditsPlanned'),
              value: f.number(c.auditsPlanned),
              href: '/quality?tab=audits',
            },
            {
              key: 'cold',
              label: t('countColdExcursions'),
              value: f.number(c.coldExcursions7d),
              detail: t('last7Days'),
              href: '/cold-storage',
              alert: c.coldExcursions7d > 0,
            },
          ]}
        />
      </section>

      <Compliance data={data} />
    </div>
  )
}
