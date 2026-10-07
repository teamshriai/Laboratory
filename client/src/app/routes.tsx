import { Navigate, type RouteObject } from 'react-router'
import { LegacyRedirect } from '@/app/legacy-redirect'
import type { TKey } from '@/i18n/core'
import { AppShell } from '@/app/layout/app-shell'
import { SessionGate } from '@/app/session-gate'
import { AppLoading, NotFoundPage, RouteError } from '@/app/layout/route-states'
import { HomeRedirect } from '@/app/home-redirect'

const crumb = (key: TKey<'nav'>, to?: string) => ({ crumb: key, crumbTo: to })

export const routes: RouteObject[] = [
  // Links and bookmarks from before the URLs dropped the /laboratory prefix.
  { path: '/laboratory/*', element: <LegacyRedirect /> },
  // Public pages, outside the staff shell and its sign-in: a report behind a
  // share link (after the patient's date of birth) and the verification
  // page behind a report's QR code.
  {
    path: '/r/:token',
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    lazy: () => import('@/features/portal/report-portal-page'),
  },
  {
    path: '/v/:token',
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    lazy: () => import('@/features/portal/verify-page'),
  },
  // Links made before tokens carried the report number; they no longer open.
  {
    path: '/report/:reportNo',
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    lazy: () => import('@/features/portal/old-link-page'),
  },
  {
    path: '/',
    // Staff screens open only for a signed-in session (backend builds).
    element: (
      <SessionGate>
        <AppShell />
      </SessionGate>
    ),
    // The shell itself failing (header, sidebar, palette) still gets a
    // recoverable screen rather than the router's default error page.
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    handle: crumb('sectionLaboratory', '/dashboard'),
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            path: 'dashboard',
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
            path: 'reception',
            handle: crumb('processing'),
            lazy: () => import('@/features/samples/processing-page'),
          },
          {
            path: 'specimens/:sampleId',
            handle: crumb('sample'),
            lazy: () => import('@/features/samples/sample-page'),
          },
          {
            path: 'worklists',
            handle: crumb('results'),
            lazy: () => import('@/features/results/worklist-page'),
          },
          {
            // Result entry for one specimen, under the Worklists crumb.
            path: 'results',
            handle: crumb('results', '/worklists'),
            children: [
              { index: true, element: <Navigate to="/worklists" replace /> },
              {
                path: ':sampleId',
                handle: crumb('sample'),
                lazy: () => import('@/features/results/result-entry-page'),
              },
            ],
          },
          {
            path: 'verification',
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
            path: 'critical-results',
            handle: crumb('criticalValues'),
            lazy: () => import('@/features/critical/critical-page'),
          },
          {
            path: 'imaging',
            handle: crumb('imaging', '/imaging'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/imaging/imaging-page'),
              },
              {
                path: 'ct',
                handle: crumb('imagingCt'),
                lazy: () => import('@/features/imaging/modality-page'),
              },
              {
                path: 'mri',
                handle: crumb('imagingMri'),
                lazy: () => import('@/features/imaging/modality-page'),
              },
              {
                path: 'x-ray',
                handle: crumb('imagingXray'),
                lazy: () => import('@/features/imaging/modality-page'),
              },
              {
                path: 'reports/:studyId',
                handle: crumb('imagingReport'),
                lazy: () => import('@/features/imaging/imaging-report-page'),
              },
            ],
          },
          {
            path: 'billing',
            handle: crumb('billing', '/billing'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/billing/billing-page'),
              },
              {
                path: 'day-book',
                handle: crumb('dayBook'),
                lazy: () => import('@/features/billing/day-book-page'),
              },
              {
                path: 'masters',
                handle: crumb('billingMasters'),
                lazy: () => import('@/features/billing/masters-page'),
              },
              {
                path: ':invoiceId',
                handle: crumb('invoice'),
                lazy: () => import('@/features/billing/invoice-page'),
              },
            ],
          },
          {
            path: 'home-collection',
            handle: crumb('homeCollection'),
            lazy: () =>
              import('@/features/home-collection/home-collection-page'),
          },
          {
            path: 'messages',
            handle: crumb('messages'),
            lazy: () => import('@/features/messaging/messaging-page'),
          },
          {
            path: 'referrers',
            handle: crumb('referrers'),
            lazy: () => import('@/features/network/referrers-page'),
          },
          {
            path: 'my-patients',
            handle: crumb('myPatients', '/my-patients'),
            children: [
              {
                index: true,
                lazy: () => import('@/features/doctor-portal/my-patients-page'),
              },
              {
                path: ':patientId',
                handle: crumb('patient'),
                lazy: () =>
                  import('@/features/doctor-portal/doctor-patient-page'),
              },
            ],
          },
          {
            path: 'quality',
            handle: crumb('quality'),
            lazy: () => import('@/features/quality/quality-page'),
          },
          {
            path: 'cold-storage',
            handle: crumb('coldStorage'),
            lazy: () => import('@/features/cold-storage/cold-storage-page'),
          },
          {
            path: 'registers',
            handle: crumb('registers'),
            lazy: () => import('@/features/registers/registers-page'),
          },
          {
            path: 'privacy',
            handle: crumb('privacy'),
            lazy: () => import('@/features/privacy/privacy-page'),
          },
          {
            path: 'interfaces',
            handle: crumb('interfaces'),
            lazy: () => import('@/features/interfaces/interfaces-page'),
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
            path: 'users',
            handle: crumb('users'),
            lazy: () => import('@/features/admin/users-page'),
          },
          {
            path: 'audit-log',
            handle: crumb('auditLog'),
            lazy: () => import('@/features/admin/audit-log-page'),
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
