import {
  ActivityIcon,
  BookOpenCheckIcon,
  FlaskConicalIcon,
  InboxIcon,
  ListTreeIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/app/layout/page-header'
import { useT } from '@/i18n/context'
import { useInterfaces } from '@/services/queries'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { CodingPanel } from './coding-panel'
import {
  INTERFACE_TABS,
  type InterfaceTab,
  type MappingDraft,
} from './interfaces'
import { MappingDialog } from './mapping-dialog'
import { MappingsPanel } from './mappings-panel'
import { MessagesPanel } from './messages-panel'
import { MonitorPanel } from './monitor-panel'

export function Component() {
  const t = useT('interfaces')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: InterfaceTab = INTERFACE_TABS.includes(raw as InterfaceTab)
    ? (raw as InterfaceTab)
    : 'monitor'
  const { data, isPending, isError, refetch } = useInterfaces()
  const [draft, setDraft] = useState<MappingDraft | null>(null)
  // Each tab has its own filters; switching tabs drops them.
  const setTab = (next: string) =>
    setParams(
      () => {
        const out = new URLSearchParams()
        if (next !== 'monitor') out.set('tab', next)
        return out
      },
      { replace: true },
    )
  const state = {
    data,
    isPending,
    isError,
    onRetry: () => void refetch(),
  }

  return (
    <>
      <PageHeader title={t('title')} meta={<span>{t('meta')}</span>} />
      <div
        role="note"
        className="mb-5 flex max-w-4xl items-start gap-3 rounded-xl border border-warning-text/25 bg-warning-soft px-4 py-3"
      >
        <FlaskConicalIcon
          className="mt-0.5 size-5 shrink-0 text-warning-text"
          aria-hidden
        />
        <div className="min-w-0 text-meta text-warning-text">
          <p className="font-semibold">{t('simulatedTitle')}</p>
          <p className="mt-0.5">{t('simulatedBody')}</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'monitor',
              label: t('tabMonitor'),
              icon: <ActivityIcon aria-hidden />,
              ...(data ? { count: data.interfaces.length } : {}),
            },
            {
              value: 'messages',
              label: t('tabMessages'),
              icon: <InboxIcon aria-hidden />,
              ...(data ? { count: data.messages.length } : {}),
            },
            {
              value: 'mappings',
              label: t('tabMappings'),
              icon: <ListTreeIcon aria-hidden />,
              ...(data ? { count: data.mappings.length } : {}),
            },
            {
              value: 'coding',
              label: t('tabCoding'),
              icon: <BookOpenCheckIcon aria-hidden />,
              ...(data ? { count: data.coverage.analytes } : {}),
            },
          ]}
        />
        <TabsContent value="monitor">
          <MonitorPanel {...state} />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesPanel {...state} onMap={setDraft} />
        </TabsContent>
        <TabsContent value="mappings">
          <MappingsPanel {...state} onEdit={setDraft} />
        </TabsContent>
        <TabsContent value="coding">
          <CodingPanel {...state} />
        </TabsContent>
      </Tabs>
      {draft && data ? (
        <MappingDialog
          draft={draft}
          data={data}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </>
  )
}
