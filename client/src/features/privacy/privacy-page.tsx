import {
  ArchiveIcon,
  InboxIcon,
  MailIcon,
  PhoneIcon,
  ScaleIcon,
  ServerIcon,
  SirenIcon,
  UserRoundCheckIcon,
} from 'lucide-react'
import { useSearchParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { usePrivacy } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { Card } from '@/components/ui/card'
import { IconGlyph } from '@/components/ui/icon-tile'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { HoldsPanel } from './holds-panel'
import { IncidentsPanel } from './incidents-panel'
import { isRequestOpen, PRIVACY_TABS, type PrivacyTab } from './privacy'
import { RequestsPanel } from './requests-panel'
import { RetentionPanel } from './retention-panel'

export function Component() {
  const t = useT('privacy')
  const [tab, setTab] = useSearchParam<PrivacyTab>(
    'tab',
    'requests',
    PRIVACY_TABS,
  )
  const { data, isPending, isError, refetch } = usePrivacy()
  const retry = () => void refetch()
  const officer = data?.grievanceOfficer
  const openRequests = data?.requests.filter((r) => isRequestOpen(r.state))
  const openIncidents = data?.breaches.filter((b) => b.state !== 'closed')
  const activeHolds = data?.holds.filter((h) => !h.releasedAt)

  return (
    <>
      <PageHeader title={t('title')} meta={<span>{t('pageMeta')}</span>} />

      <Card className="mb-5 grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-start gap-3">
          <IconGlyph
            icon={<UserRoundCheckIcon />}
            tone="violet"
            size={20}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">
              {t('grievanceOfficer')}
            </h2>
            {isPending ? (
              <div className="mt-1.5 grid gap-1.5" role="status" aria-busy>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : isError || !officer ? (
              <p className="mt-1 text-meta text-fg-muted">
                {t('officerUnavailable')}
              </p>
            ) : (
              <div className="mt-0.5 grid gap-0.5">
                <p className="text-sm text-fg">{officer.name || t('notSet')}</p>
                <div className="flex flex-wrap gap-x-4">
                  {officer.email ? (
                    <a
                      href={`mailto:${officer.email}`}
                      className="inline-flex min-h-6 items-center gap-1.5 py-0.5 text-meta break-all text-accent-text hover:underline"
                    >
                      <MailIcon className="size-3.5 shrink-0" aria-hidden />
                      {officer.email}
                    </a>
                  ) : null}
                  {officer.phone ? (
                    <a
                      href={`tel:${officer.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex min-h-6 items-center gap-1.5 py-0.5 text-meta whitespace-nowrap text-accent-text hover:underline"
                    >
                      <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
                      {officer.phone}
                    </a>
                  ) : null}
                </div>
                {data ? (
                  <p className="text-meta text-fg-muted">
                    {t('answerWithin', { count: data.dataRequestDays })}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3 border-line lg:border-l lg:pl-5">
          <IconGlyph
            icon={<ServerIcon />}
            tone="sky"
            size={20}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">
              {t('enforcementTitle')}
            </h2>
            <p className="mt-0.5 text-meta text-fg-muted">
              {t('serverEnforced')}
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PrivacyTab)}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'requests',
              label: t('tabRequests'),
              icon: <InboxIcon />,
              ...(openRequests ? { count: openRequests.length } : {}),
            },
            {
              value: 'incidents',
              label: t('tabIncidents'),
              icon: <SirenIcon />,
              ...(openIncidents ? { count: openIncidents.length } : {}),
            },
            {
              value: 'holds',
              label: t('tabHolds'),
              icon: <ScaleIcon />,
              ...(activeHolds ? { count: activeHolds.length } : {}),
            },
            {
              value: 'retention',
              label: t('tabRetention'),
              icon: <ArchiveIcon />,
            },
          ]}
        />
        <TabsContent value="requests">
          <RequestsPanel
            requests={data?.requests}
            isPending={isPending}
            isError={isError}
            onRetry={retry}
          />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentsPanel
            breaches={data?.breaches}
            isPending={isPending}
            isError={isError}
            onRetry={retry}
          />
        </TabsContent>
        <TabsContent value="holds">
          <HoldsPanel
            holds={data?.holds}
            isPending={isPending}
            isError={isError}
            onRetry={retry}
          />
        </TabsContent>
        {/* Kept mounted so unsaved edits survive a look at another tab. */}
        <TabsContent
          value="retention"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <RetentionPanel
            retention={data?.retention}
            isPending={isPending}
            isError={isError}
            onRetry={retry}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
