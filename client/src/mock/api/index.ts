// The laboratory API. Today it is served from the in-browser mock database;
// the Node backend will implement the same functions.

import {
  dashboardApi,
  analyticsApi,
  departmentsApi,
  notificationsApi,
  searchApi,
  tatApi,
  workQueueApi,
} from './overview'
import { catalogApi, equipmentApi, inventoryApi, qcApi } from './operations'
import { criticalApi, patientsApi } from './clinical'
import { ordersApi } from './orders'
import { reportsApi } from './reports'
import { resultsApi, validationApi } from './results'
import { samplesApi } from './samples'
import { analyticsReportApi } from './analytics'
import { workQueueListApi } from './work-queue'
import { referenceApi, systemApi } from './system'

export const labApi = {
  dashboard: dashboardApi,
  workQueue: { ...workQueueApi, ...workQueueListApi },
  patients: patientsApi,
  orders: ordersApi,
  samples: samplesApi,
  results: resultsApi,
  validation: validationApi,
  reports: reportsApi,
  critical: criticalApi,
  catalog: catalogApi,
  inventory: inventoryApi,
  equipment: equipmentApi,
  qc: qcApi,
  tat: tatApi,
  analytics: { ...analyticsApi, ...analyticsReportApi },
  departments: departmentsApi,
  search: searchApi,
  notifications: notificationsApi,
  reference: referenceApi,
  system: systemApi,
}

export type LabApi = typeof labApi
export type * from './types'
export { MILESTONES, WORK_BUCKETS } from './types'
export type { OrderInput } from './orders'
export type { ItemResultsInput } from './results'
export type { DocumentCriticalInput, RegisterPatientInput } from './clinical'
export type {
  NewAnalyteInput,
  EquipmentLogInput,
  QcRunInput,
  RangesInput,
  ReceiveLotInput,
  TestInput,
} from './operations'
export type { DemoSettings } from './runtime'
export {
  getActor,
  getDemoSettings,
  isLabApiError,
  setActor,
  setDemoSettings,
} from './runtime'
export { LabApiError, type ErrorCode } from '../engine/core'
export { onStorageResult, wasDataRefreshed } from '../db/store'
export { isAnalyteRequired } from '../engine/results'
