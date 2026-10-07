import {
  PipetteIcon,
  BellRingIcon,
  LibraryIcon,
  TrendingUpIcon,
  ClipboardListIcon,
  BoxIcon,
  DnaIcon,
  DropletIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GaugeIcon,
  HeartPulseIcon,
  MicroscopeIcon,
  PackageIcon,
  ListOrderedIcon,
  BadgeCheckIcon,
  ShieldCheckIcon,
  LayoutGridIcon,
  SyringeIcon,
  TestTubeIcon,
  TimerIcon,
  UsersIcon,
  BiohazardIcon,
  WrenchIcon,
  PencilLineIcon,
  LayersIcon,
  ScrollTextIcon,
  UserCogIcon,
  ScanLineIcon,
  BrainIcon,
  BoneIcon,
  RadiationIcon,
  ReceiptIndianRupeeIcon,
  HouseIcon,
  MessageSquareTextIcon,
  StethoscopeIcon,
  ContactIcon,
  AwardIcon,
  ThermometerSnowflakeIcon,
  BookMarkedIcon,
  LockKeyholeIcon,
  CableIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Permission } from '@/domain/permissions'
import type { DepartmentId, ModuleId } from '@/domain/types'
import type { WorkStage } from '@/services/lab-api'

export type NavKey =
  | 'overview'
  | 'workQueue'
  | 'patients'
  | 'orders'
  | 'collection'
  | 'processing'
  | 'results'
  | 'validation'
  | 'reports'
  | 'inventory'
  | 'reagents'
  | 'consumables'
  | 'equipment'
  | 'qualityControl'
  | 'criticalValues'
  | 'tat'
  | 'analytics'
  | 'testCatalog'
  | 'users'
  | 'auditLog'
  | 'imaging'
  | 'imagingCt'
  | 'imagingMri'
  | 'imagingXray'
  | 'billing'
  | 'homeCollection'
  | 'messages'
  | 'referrers'
  | 'myPatients'
  | 'quality'
  | 'coldStorage'
  | 'registers'
  | 'privacy'
  | 'interfaces'

export interface NavItem {
  key: NavKey
  to: string
  icon: ReactNode
  /** Work-queue stages whose count is shown as a badge. */
  badge?: WorkStage[]
  badgeTone?: 'danger' | 'accent' | 'neutral'
  end?: boolean
  /** Shown only to roles holding one of these (the API still refuses). */
  anyOf?: Permission[]
  /** Hidden while this module is switched off in Settings. */
  module?: ModuleId
}

export const LAB_NAV: NavItem[] = [
  { key: 'overview', to: '/dashboard', icon: <LayoutGridIcon />, end: true },
  { key: 'workQueue', to: '/work-queue', icon: <ListOrderedIcon /> },
  { key: 'patients', to: '/patients', icon: <UsersIcon /> },
  { key: 'orders', to: '/orders', icon: <ClipboardListIcon /> },
  {
    key: 'collection',
    to: '/collection',
    icon: <SyringeIcon />,
    badge: ['collect', 'recollect'],
  },
  {
    key: 'processing',
    to: '/reception',
    icon: <TestTubeIcon />,
    badge: ['receive', 'process'],
  },
  {
    key: 'results',
    to: '/worklists',
    icon: <PencilLineIcon />,
    badge: ['enter'],
  },
  {
    key: 'validation',
    to: '/verification',
    icon: <BadgeCheckIcon />,
    badge: ['validate'],
    badgeTone: 'accent',
  },
  {
    key: 'criticalValues',
    to: '/critical-results',
    icon: <BellRingIcon />,
    badge: ['acknowledge'],
    badgeTone: 'danger',
  },
  {
    key: 'reports',
    to: '/reports',
    icon: <FileTextIcon />,
    badge: ['release'],
  },
]

export const DEPARTMENT_ICONS: Record<DepartmentId, ReactNode> = {
  hematology: <DropletIcon />,
  biochemistry: <FlaskConicalIcon />,
  'clinical-pathology': <PipetteIcon />,
  microbiology: <BiohazardIcon />,
  immunology: <ShieldCheckIcon />,
  serology: <HeartPulseIcon />,
  histopathology: <MicroscopeIcon />,
  cytology: <DnaIcon />,
}

export const INVENTORY_NAV: NavItem[] = [
  {
    key: 'inventory',
    to: '/inventory',
    icon: <LayersIcon />,
    end: true,
    module: 'inventory',
  },
  {
    key: 'reagents',
    to: '/reagents',
    icon: <FlaskConicalIcon />,
    module: 'inventory',
  },
  {
    key: 'consumables',
    to: '/consumables',
    icon: <PackageIcon />,
    module: 'inventory',
  },
  { key: 'equipment', to: '/equipment', icon: <WrenchIcon /> },
]

export const OPERATIONS_NAV: NavItem[] = [
  {
    key: 'qualityControl',
    to: '/quality-control',
    icon: <GaugeIcon />,
  },
  { key: 'tat', to: '/tat', icon: <TimerIcon /> },
  { key: 'analytics', to: '/analytics', icon: <TrendingUpIcon /> },
]

/** Diagnostic imaging, kept apart from the laboratory's test lists. */
export const IMAGING_NAV: NavItem[] = [
  {
    key: 'imaging',
    to: '/imaging',
    icon: <ScanLineIcon />,
    end: true,
    module: 'imaging',
  },
  {
    key: 'imagingCt',
    to: '/imaging/ct',
    icon: <RadiationIcon />,
    module: 'imaging',
  },
  {
    key: 'imagingMri',
    to: '/imaging/mri',
    icon: <BrainIcon />,
    module: 'imaging',
  },
  {
    key: 'imagingXray',
    to: '/imaging/x-ray',
    icon: <BoneIcon />,
    module: 'imaging',
  },
]

/** Money and the lab's reach: invoices, home visits and patient messages. */
export const BUSINESS_NAV: NavItem[] = [
  {
    key: 'billing',
    to: '/billing',
    icon: <ReceiptIndianRupeeIcon />,
    anyOf: ['billing.invoice', 'billing.manage', 'revenue.view'],
    module: 'billing',
  },
  {
    key: 'homeCollection',
    to: '/home-collection',
    icon: <HouseIcon />,
    anyOf: ['home.book', 'home.dispatch', 'specimen.collect'],
    module: 'homeCollection',
  },
  {
    key: 'messages',
    to: '/messages',
    icon: <MessageSquareTextIcon />,
    anyOf: ['messaging.manage', 'report.share'],
    module: 'messaging',
  },
]

/** The quality system and the lab's statutory and privacy records. */
export const QUALITY_NAV: NavItem[] = [
  { key: 'quality', to: '/quality', icon: <AwardIcon />, module: 'quality' },
  {
    key: 'coldStorage',
    to: '/cold-storage',
    icon: <ThermometerSnowflakeIcon />,
    module: 'quality',
  },
  {
    key: 'registers',
    to: '/registers',
    icon: <BookMarkedIcon />,
    module: 'compliance',
  },
  {
    key: 'privacy',
    to: '/privacy',
    icon: <LockKeyholeIcon />,
    anyOf: ['privacy.manage', 'settings.edit'],
    module: 'compliance',
  },
  {
    key: 'interfaces',
    to: '/interfaces',
    icon: <CableIcon />,
    module: 'interfaces',
  },
]

/** The referring doctor's own view; the only section a doctor sees. */
export const DOCTOR_NAV: NavItem[] = [
  {
    key: 'myPatients',
    to: '/my-patients',
    icon: <StethoscopeIcon />,
    module: 'doctorPortal',
  },
]

/** Changes rarely and needs the lab manager (audit §28). */
export const ADMIN_NAV: NavItem[] = [
  {
    key: 'referrers',
    to: '/referrers',
    icon: <ContactIcon />,
    anyOf: ['masters.manage'],
  },
  { key: 'testCatalog', to: '/test-catalog', icon: <LibraryIcon /> },
  { key: 'users', to: '/users', icon: <UserCogIcon /> },
  { key: 'auditLog', to: '/audit-log', icon: <ScrollTextIcon /> },
]

export const CUBE_ICON = <BoxIcon />
