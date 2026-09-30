import { Navigate, type RouteObject } from 'react-router'
import type { TKey } from '@/i18n/core'
import { AppShell } from '@/app/layout/app-shell'
import { AppLoading, NotFoundPage, RouteError } from '@/app/layout/route-states'

const crumb = (key: TKey<'nav'>) => ({ crumb: key })

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/laboratory" replace />,
    errorElement: <RouteError />,
  },
  {
    path: '/laboratory',
    element: <AppShell />,
    // The shell itself failing (header, sidebar, palette) still gets a
    // recoverable screen rather than the router's default error page.
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    handle: crumb('sectionLaboratory'),
    children: [
      {
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            handle: crumb('overview'),
            lazy: () => import('@/features/dashboard/dashboard-page'),
          },
          {
            path: 'work-queue',
            handle: crumb('workQueue'),
            lazy: () => import('@/features/work-queue/work-queue-page'),
          },
          {
            path: 'patients',
            handle: crumb('patients'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/patients/patients-page'),
              },
              {
                path: ':patientId',
                handle: crumb('patient'),
                lazy: () => import('@/features/patients/patient-page'),
              },
            ],
          },
          {
            path: 'orders',
            handle: crumb('orders'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/orders/orders-page'),
              },
              {
                path: 'new',
                handle: crumb('newOrder'),
                lazy: () => import('@/features/orders/new-order-page'),
              },
            ],
          },
          {
            path: 'collection',
            handle: crumb('collection'),
            lazy: () => import('@/features/collection/collection-page'),
          },
          {
            path: 'samples',
            handle: crumb('processing'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/samples/processing-page'),
              },
              {
                path: ':sampleId',
                handle: crumb('sample'),
                lazy: () => import('@/features/samples/sample-page'),
              },
            ],
          },
          {
            path: 'results',
            handle: crumb('results'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/results/worklist-page'),
              },
              {
                path: ':sampleId',
                handle: crumb('sample'),
                lazy: () => import('@/features/results/result-entry-page'),
              },
            ],
          },
          {
            path: 'validation',
            handle: crumb('validation'),
            lazy: () => import('@/features/validation/validation-page'),
          },
          {
            path: 'reports',
            handle: crumb('reports'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/reports/reports-page'),
              },
              {
                path: ':reportId',
                handle: crumb('report'),
                lazy: () => import('@/features/reports/report-page'),
              },
            ],
          },
          {
            path: 'critical-values',
            handle: crumb('criticalValues'),
            lazy: () => import('@/features/critical/critical-page'),
          },
          {
            path: 'test-catalog',
            handle: crumb('testCatalog'),
            lazy: () => import('@/features/catalog/catalog-page'),
          },
          {
            path: 'departments',
            handle: crumb('departments'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/departments/departments-page'),
              },
              {
                path: ':departmentId',
                lazy: () => import('@/features/departments/department-page'),
              },
            ],
          },
          {
            path: 'inventory',
            handle: crumb('inventory'),
            lazy: () => import('@/features/inventory/inventory-page'),
          },
          {
            path: 'reagents',
            handle: crumb('reagents'),
            lazy: () => import('@/features/inventory/reagents-page'),
          },
          {
            path: 'consumables',
            handle: crumb('consumables'),
            lazy: () => import('@/features/inventory/consumables-page'),
          },
          {
            path: 'equipment',
            handle: crumb('equipment'),
            lazy: () => import('@/features/equipment/equipment-page'),
          },
          {
            path: 'quality-control',
            handle: crumb('qualityControl'),
            lazy: () => import('@/features/qc/qc-page'),
          },
          {
            path: 'tat',
            handle: crumb('tat'),
            lazy: () => import('@/features/tat/tat-page'),
          },
          {
            path: 'analytics',
            handle: crumb('analytics'),
            lazy: () => import('@/features/analytics/analytics-page'),
          },
          {
            path: 'settings',
            handle: crumb('settings'),
            lazy: () => import('@/features/settings/settings-page'),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
