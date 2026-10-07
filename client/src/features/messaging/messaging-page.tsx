import { FileTextIcon, InboxIcon, PlugZapIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { useT } from '@/i18n/context'
import { useMessaging } from '@/services/queries'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { OutboxPanel } from './outbox-panel'
import { TemplatesPanel } from './templates-panel'

const TABS = ['outbox', 'templates'] as const
type Tab = (typeof TABS)[number]

export function Component() {
  const t = useT('network')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'outbox'
  const { data, isPending, isError, refetch } = useMessaging()
  // The outbox filters belong to the outbox; switching tabs drops them.
  const setTab = (next: string) =>
    setParams(
      () => {
        const out = new URLSearchParams()
        if (next !== 'outbox') out.set('tab', next)
        return out
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader
        title={t('messagesTitle')}
        meta={<span>{t('messagesMeta')}</span>}
      />
      <div
        role="note"
        className="mb-5 flex max-w-4xl items-start gap-3 rounded-xl border border-warning-text/25 bg-warning-soft px-4 py-3"
      >
        <PlugZapIcon
          className="mt-0.5 size-5 shrink-0 text-warning-text"
          aria-hidden
        />
        <div className="min-w-0 text-meta text-warning-text">
          <p className="font-semibold">{t('noGatewayTitle')}</p>
          <p className="mt-0.5">{t('noGatewayBody')}</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'outbox',
              label: t('outboxTitle'),
              icon: <InboxIcon aria-hidden />,
              ...(data ? { count: data.outbox.length } : {}),
            },
            {
              value: 'templates',
              label: t('templatesTitle'),
              icon: <FileTextIcon aria-hidden />,
              ...(data ? { count: data.templates.length } : {}),
            },
          ]}
        />
        <TabsContent value="outbox">
          <OutboxPanel
            outbox={data?.outbox}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
          />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesPanel
            templates={data?.templates}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
