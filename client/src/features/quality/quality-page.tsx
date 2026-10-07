import {
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseZapIcon,
  FileTextIcon,
  GaugeIcon,
  ListChecksIcon,
  ShieldAlertIcon,
  SigmaIcon,
  TargetIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  NavigationType,
  useNavigationType,
  useSearchParams,
} from 'react-router'
import { useT } from '@/i18n/context'
import { useQualityOverview } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { AuditsPanel } from './audits-panel'
import { AutoVerifyPanel } from './autoverify-panel'
import { CapaPanel } from './capa-panel'
import { DocumentsPanel } from './documents-panel'
import { EqaPanel } from './eqa-panel'
import { LisPanel } from './lis-panel'
import { OverviewPanel } from './overview-panel'
import { QUALITY_TABS, type QualityTab } from './quality'
import { AUDIT_PARAM, DOC_PARAM, LIS_PARAM } from './records-shared'
import { RisksPanel } from './risks-panel'
import { UncertaintyPanel } from './uncertainty-panel'

/** The tab that owns each record drawer's URL parameter. */
const RECORD_TABS: readonly (readonly [string, QualityTab])[] = [
  ['nc', 'capa'],
  [DOC_PARAM, 'documents'],
  [AUDIT_PARAM, 'audits'],
  [LIS_PARAM, 'lis'],
]

export function Component() {
  const t = useT('quality')
  const [params, setParams] = useSearchParams()
  const navigationType = useNavigationType()
  const raw = params.get('tab')
  // A link to a record (?nc=, ?doc=, ?audit=, ?lis=) without ?tab= opens the
  // tab that owns its drawer, and that tab stays when the drawer closes (the
  // record is removed in place) and while its filters change.
  const recordTab = RECORD_TABS.find(([key]) => params.get(key))?.[1]
  const [linkedTab, setLinkedTab] = useState<QualityTab | null>(
    recordTab ?? null,
  )
  if (recordTab && recordTab !== linkedTab) setLinkedTab(recordTab)
  const tab: QualityTab = QUALITY_TABS.includes(raw as QualityTab)
    ? (raw as QualityTab)
    : (recordTab ??
      (navigationType === NavigationType.Replace ? linkedTab : null) ??
      'overview')
  const { data } = useQualityOverview()
  const counts = data?.counts

  // A new tab starts clean: the old tab's filters and open record go.
  const changeTab = (next: string) => {
    setLinkedTab(null)
    setParams(() => {
      const out = new URLSearchParams()
      if (next !== 'overview') out.set('tab', next)
      return out
    })
  }

  return (
    <>
      <PageHeader title={t('title')} meta={<span>{t('pageMeta')}</span>} />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'overview',
              label: t('tab.overview'),
              icon: <GaugeIcon />,
            },
            {
              value: 'eqa',
              label: t('tab.eqa'),
              icon: <TargetIcon />,
              ...(counts ? { count: counts.eqaPending } : {}),
            },
            {
              value: 'capa',
              label: t('tab.capa'),
              icon: <ClipboardCheckIcon />,
              ...(counts ? { count: counts.ncOpen } : {}),
            },
            {
              value: 'documents',
              label: t('tab.documents'),
              icon: <FileTextIcon />,
            },
            {
              value: 'audits',
              label: t('tab.audits'),
              icon: <ClipboardListIcon />,
            },
            {
              value: 'risks',
              label: t('tab.risks'),
              icon: <ShieldAlertIcon />,
              ...(counts ? { count: counts.risksHigh } : {}),
            },
            { value: 'lis', label: t('tab.lis'), icon: <DatabaseZapIcon /> },
            {
              value: 'uncertainty',
              label: t('tab.uncertainty'),
              icon: <SigmaIcon />,
            },
            {
              value: 'autoverify',
              label: t('tab.autoverify'),
              icon: <ListChecksIcon />,
            },
          ]}
        />
        <TabsContent value="overview">
          <OverviewPanel />
        </TabsContent>
        <TabsContent value="eqa">
          <EqaPanel />
        </TabsContent>
        <TabsContent value="capa">
          <CapaPanel />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel />
        </TabsContent>
        <TabsContent value="audits">
          <AuditsPanel />
        </TabsContent>
        <TabsContent value="risks">
          <RisksPanel />
        </TabsContent>
        <TabsContent value="lis">
          <LisPanel />
        </TabsContent>
        <TabsContent value="uncertainty">
          <UncertaintyPanel />
        </TabsContent>
        <TabsContent value="autoverify">
          <AutoVerifyPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}
