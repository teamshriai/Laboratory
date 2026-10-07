import { MapPinnedIcon, StethoscopeIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { useT } from '@/i18n/context'
import { useNetworkMasters } from '@/services/queries'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { CentresPanel } from './centres-panel'
import { DoctorsPanel } from './doctors-panel'

const TABS = ['doctors', 'centres'] as const
type Tab = (typeof TABS)[number]

export function Component() {
  const t = useT('network')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'doctors'
  const { data, isPending, isError, refetch } = useNetworkMasters()
  // Each tab has its own filters; switching starts the other one fresh.
  const setTab = (next: string) =>
    setParams(
      () => {
        const out = new URLSearchParams()
        if (next !== 'doctors') out.set('tab', next)
        return out
      },
      { replace: true },
    )
  const activeDoctors = data?.doctors.filter((d) => d.active !== false).length
  const activeCentres = data?.centres.filter((c) => c.active).length

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          data ? (
            <span>
              {t('pageMeta', {
                doctors: activeDoctors ?? 0,
                centres: activeCentres ?? 0,
              })}
            </span>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'doctors',
              label: t('doctorsTitle'),
              icon: <StethoscopeIcon aria-hidden />,
              ...(data ? { count: data.doctors.length } : {}),
            },
            {
              value: 'centres',
              label: t('centresTitle'),
              icon: <MapPinnedIcon aria-hidden />,
              ...(data ? { count: data.centres.length } : {}),
            },
          ]}
        />
        <TabsContent value="doctors">
          <DoctorsPanel
            doctors={data?.doctors}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
          />
        </TabsContent>
        <TabsContent value="centres">
          <CentresPanel
            centres={data?.centres}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
