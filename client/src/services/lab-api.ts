// The single seam between the screens and the data source. Screens import
// the API, its types and the demo controls from here only.
//
// `@/services/source` is the in-browser mock by default; a build with
// VITE_DATA_SOURCE=http resolves it to the HTTP adapter instead
// (services/source/http.ts, vite.config.ts). See README, "Backend seam".
export { demo, labApi } from '@/services/source'
export type { DbStats, DemoControls, DemoSettings, LabApi } from './contract'
export {
  ApiError as LabApiError,
  isApiError as isLabApiError,
  type ErrorCode,
} from '@/domain/errors'

// The DTOs: what every endpoint returns (types only; nothing from the mock
// runs in a backend build).
export type * from '@/mock/api/types'
export { ASSISTANT_INTENTS, MILESTONES, WORK_BUCKETS } from '@/mock/api/types'
export type { AccessInput, AccessKind } from '@/mock/engine/access'
export type { SignatoryInput } from '@/mock/engine/staff'
export type { ConsentInput } from '@/mock/engine/consent'
export type { OrderInput } from '@/mock/api/orders'
export type { InvoiceInput } from '@/mock/engine/billing'
export type {
  BookVisitInput,
  CentreInput,
  DoctorInput,
} from '@/mock/engine/network'
export type { TemplateInput } from '@/mock/engine/messaging'
export type {
  AuditPlanInput,
  ColdUnitInput,
  DocumentInput,
  NcInput,
  NcStepInput,
  RiskInput,
} from '@/mock/engine/quality'
export type { BreachInput, DataRequestInput } from '@/mock/engine/privacy'
export type { ItemResultsInput } from '@/mock/api/results'
export type {
  DocumentCriticalInput,
  RegisterPatientInput,
} from '@/mock/api/clinical'
export type {
  NewAnalyteInput,
  EquipmentLogInput,
  QcRunInput,
  RangesInput,
  ReceiveLotInput,
  TestInput,
} from '@/mock/api/operations'
