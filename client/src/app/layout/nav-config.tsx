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
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DepartmentId } from '@/domain/types'
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

export interface NavItem {
  key: NavKey
  to: string
  icon: ReactNode
  /** Work-queue stages whose count is shown as a badge. */
  badge?: WorkStage[]
  badgeTone?: 'danger' | 'accent' | 'neutral'
  end?: boolean
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
  },
  { key: 'reagents', to: '/reagents', icon: <FlaskConicalIcon /> },
  { key: 'consumables', to: '/consumables', icon: <PackageIcon /> },
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
  { key: 'imaging', to: '/imaging', icon: <ScanLineIcon />, end: true },
  { key: 'imagingCt', to: '/imaging/ct', icon: <RadiationIcon /> },
  { key: 'imagingMri', to: '/imaging/mri', icon: <BrainIcon /> },
  { key: 'imagingXray', to: '/imaging/x-ray', icon: <BoneIcon /> },
]

/** Changes rarely and needs the lab manager (audit §28). */
export const ADMIN_NAV: NavItem[] = [
  { key: 'testCatalog', to: '/test-catalog', icon: <LibraryIcon /> },
  { key: 'users', to: '/users', icon: <UserCogIcon /> },
  { key: 'auditLog', to: '/audit-log', icon: <ScrollTextIcon /> },
]

export const CUBE_ICON = <BoxIcon />
