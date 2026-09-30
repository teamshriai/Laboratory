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
  { key: 'overview', to: '/laboratory', icon: <LayoutGridIcon />, end: true },
  { key: 'workQueue', to: '/laboratory/work-queue', icon: <ListOrderedIcon /> },
  { key: 'patients', to: '/laboratory/patients', icon: <UsersIcon /> },
  { key: 'orders', to: '/laboratory/orders', icon: <ClipboardListIcon /> },
  {
    key: 'collection',
    to: '/laboratory/collection',
    icon: <SyringeIcon />,
    badge: ['collect', 'recollect'],
  },
  {
    key: 'processing',
    to: '/laboratory/samples',
    icon: <TestTubeIcon />,
    badge: ['receive', 'process'],
  },
  {
    key: 'results',
    to: '/laboratory/results',
    icon: <PencilLineIcon />,
    badge: ['enter'],
  },
  {
    key: 'validation',
    to: '/laboratory/validation',
    icon: <BadgeCheckIcon />,
    badge: ['validate'],
    badgeTone: 'accent',
  },
  {
    key: 'reports',
    to: '/laboratory/reports',
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
    to: '/laboratory/inventory',
    icon: <LayersIcon />,
    end: true,
  },
  { key: 'reagents', to: '/laboratory/reagents', icon: <FlaskConicalIcon /> },
  { key: 'consumables', to: '/laboratory/consumables', icon: <PackageIcon /> },
  { key: 'equipment', to: '/laboratory/equipment', icon: <WrenchIcon /> },
]

export const OPERATIONS_NAV: NavItem[] = [
  {
    key: 'qualityControl',
    to: '/laboratory/quality-control',
    icon: <GaugeIcon />,
  },
  {
    key: 'criticalValues',
    to: '/laboratory/critical-values',
    icon: <BellRingIcon />,
    badge: ['acknowledge'],
    badgeTone: 'danger',
  },
  { key: 'tat', to: '/laboratory/tat', icon: <TimerIcon /> },
  { key: 'analytics', to: '/laboratory/analytics', icon: <TrendingUpIcon /> },
  { key: 'testCatalog', to: '/laboratory/test-catalog', icon: <LibraryIcon /> },
]

export const CUBE_ICON = <BoxIcon />
