// The REST contract: one entry for every method the screens call, with the
// HTTP method, the path and how the call's arguments become path
// parameters, query and body. It is typed against `LabApi`, so a method
// with no endpoint (or an endpoint with the wrong arguments) fails the
// typecheck. `npm run contract` prints it as docs/api-contract.md.
//
// Conventions for the backend:
// - Paths are under `/v1`; ids are opaque strings.
// - GET filters arrive as query parameters (arrays repeat the key; nested
//   objects as JSON). Writes send a JSON body.
// - Responses are the DTOs in mock/api/types.ts; times are epoch ms.
// - Errors are `{ code, params, requestId }` with an HTTP status, where
//   `code` is one of ERROR_CODES (domain/errors.ts).
// - Every write is checked on the server: permission, workflow transition,
//   signer rules, and an audit entry in the same transaction (README,
//   "Backend seam").

import type { LabApi } from '../contract'
import type { HttpMethod } from './client'

export interface Mapped {
  params?: Record<string, string | number>
  query?: Record<string, unknown>
  body?: unknown
}

export interface Endpoint<A extends unknown[]> {
  method: HttpMethod
  /** Path with `:name` segments filled from `params`. */
  path: string
  map: (...args: A) => Mapped
}

type Args<F> = F extends (...args: infer A) => unknown ? A : never

export type EndpointTable = {
  [N in keyof LabApi]: {
    [M in keyof LabApi[N]]: Endpoint<Args<LabApi[N][M]>>
  }
}

const none = () => ({})

const make =
  (method: HttpMethod) =>
  <A extends unknown[]>(
    path: string,
    map: (...args: A) => Mapped = none,
  ): Endpoint<A> => ({ method, path, map })

const get = make('GET')
const post = make('POST')
const put = make('PUT')
const patch = make('PATCH')
const del = make('DELETE')

/* Common argument shapes. */
const byId = (id: string) => ({ params: { id } })
const filters = (query?: object) => ({ query: { ...query } })
const idBody = (id: string, body: unknown) => ({ params: { id }, body })
const body = (value: unknown) => ({ body: value })

export const ENDPOINTS: EndpointTable = {
  session: {
    get: get('/v1/session'),
  },
  dashboard: {
    get: get('/v1/dashboard'),
  },
  workQueue: {
    list: get('/v1/work-queue', filters),
    get: get('/v1/work-queue/summary', (department) => ({
      query: { department },
    })),
  },
  patients: {
    list: get('/v1/patients', filters),
    get: get('/v1/patients/:id', byId),
    register: post('/v1/patients', body),
    update: patch('/v1/patients/:id', idBody),
    addNote: post('/v1/patients/:id/notes', (id, text) => ({
      params: { id },
      body: { text },
    })),
    merge: post('/v1/patients/merge', body),
    recordConsent: post('/v1/patients/:id/consents', idBody),
    withdrawConsent: post('/v1/consents/:id/withdraw', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
  },
  orders: {
    list: get('/v1/orders', filters),
    get: get('/v1/orders/:id', byId),
    create: post('/v1/orders', body),
    saveDraft: put('/v1/order-drafts', (input, draftId) => ({
      body: { input, draftId },
    })),
    submitDraft: post('/v1/order-drafts/:id/submit', idBody),
    discardDraft: del('/v1/order-drafts/:id', byId),
    cancel: post('/v1/orders/:id/cancel', idBody),
    setPriority: patch('/v1/orders/:id/priority', (id, priority) => ({
      params: { id },
      body: { priority },
    })),
    addTests: post('/v1/orders/:id/tests', (id, testIds) => ({
      params: { id },
      body: { testIds },
    })),
    removeTest: post('/v1/order-items/:id/remove', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
  },
  samples: {
    collectionQueue: get('/v1/specimens/collection-queue', filters),
    processing: get('/v1/specimens/processing', filters),
    get: get('/v1/specimens/:id', byId),
    lookup: get('/v1/specimens/lookup', (ref) => ({ query: { ref } })),
    printLabels: post('/v1/specimens/labels', (ids) => ({ body: { ids } })),
    collect: post('/v1/specimens/:id/collect', idBody),
    receive: post('/v1/specimens/receive', (ref, input) => ({
      body: { ref, ...input },
    })),
    schedule: post('/v1/specimens/:id/schedule', idBody),
    split: post('/v1/specimens/:id/aliquots', (id, groups) => ({
      params: { id },
      body: { groups },
    })),
    sendOut: post('/v1/specimens/:id/send-out', idBody),
    updateSendOut: post('/v1/specimens/:id/send-out/state', idBody),
    start: post('/v1/specimens/:id/start', (id, equipmentId) => ({
      params: { id },
      body: { equipmentId },
    })),
    hold: post('/v1/specimens/:id/hold', idBody),
    resume: post('/v1/specimens/:id/resume', byId),
    assign: post('/v1/specimens/assign', (ids, staffId) => ({
      body: { ids, staffId },
    })),
    startMany: post('/v1/specimens/start', (ids) => ({ body: { ids } })),
    reject: post('/v1/specimens/:id/reject', idBody),
  },
  results: {
    worklist: get('/v1/worklists', filters),
    entry: get('/v1/specimens/:id/results', byId),
    save: put('/v1/specimens/:id/results', (id, entries, submit) => ({
      params: { id },
      body: { entries, submit },
    })),
    rerun: post('/v1/order-items/:id/rerun', idBody),
  },
  validation: {
    queue: get('/v1/verification', filters),
    stageCounts: get('/v1/verification/counts', filters),
    review: post('/v1/verification/review', (itemIds) => ({
      body: { itemIds },
    })),
    validate: post('/v1/verification/authorise', (itemIds) => ({
      body: { itemIds },
    })),
    sendBack: post('/v1/order-items/:id/send-back', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    hold: post('/v1/order-items/:id/hold', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    comment: post('/v1/order-items/:id/comments', (id, text, visibility) => ({
      params: { id },
      body: { text, visibility },
    })),
  },
  reports: {
    list: get('/v1/reports', filters),
    createShareLink: post('/v1/reports/:id/share-links', idBody),
    revokeShareLink: post('/v1/share-links/:id/revoke', byId),
    get: get('/v1/reports/:id', (id, options) => ({
      params: { id },
      query: { ...options },
    })),
    release: post('/v1/reports/:id/release', idBody),
    requestCorrection: post('/v1/reports/:id/corrections', idBody),
    authoriseCorrection: post('/v1/reports/:id/corrections/authorise', byId),
    declineCorrection: post(
      '/v1/reports/:id/corrections/decline',
      (id, reason) => ({ params: { id }, body: { reason } }),
    ),
    correct: post('/v1/reports/:id/correct', idBody),
    share: post('/v1/reports/:id/share', idBody),
    recordPrint: post('/v1/reports/:id/prints', byId),
    setInterpretation: put('/v1/reports/:id/interpretation', (id, text) => ({
      params: { id },
      body: { text },
    })),
    withdraw: post('/v1/reports/:id/withdraw', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
  },
  critical: {
    list: get('/v1/critical-results', filters),
    get: get('/v1/critical-results/:id', byId),
    document: post('/v1/critical-results/:id/notifications', idBody),
    acknowledge: post('/v1/critical-results/:id/acknowledge', idBody),
    escalate: post('/v1/critical-results/:id/escalate', idBody),
    void: post('/v1/critical-results/:id/void', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
  },
  catalog: {
    list: get('/v1/tests', filters),
    get: get('/v1/tests/:id', byId),
    orderable: get('/v1/tests/orderable'),
    analytes: get('/v1/analytes'),
    create: post('/v1/tests', (input, newAnalyte) => ({
      body: { input, newAnalyte },
    })),
    update: patch('/v1/tests/:id', (id, change, reason, newAnalyte) => ({
      params: { id },
      body: { patch: change, reason, newAnalyte },
    })),
    setActive: post('/v1/tests/:id/active', (id, active, reason) => ({
      params: { id },
      body: { active, reason },
    })),
    saveRanges: put(
      '/v1/analytes/:id/reference-intervals',
      (id, input, reason) => ({ params: { id }, body: { input, reason } }),
    ),
  },
  inventory: {
    overview: get('/v1/inventory/overview'),
    lots: get('/v1/inventory/lots', filters),
    reagents: get('/v1/inventory/reagents'),
    consumables: get('/v1/inventory/consumables', filters),
    meta: get('/v1/inventory/meta'),
    items: get('/v1/inventory/items', filters),
    item: get('/v1/inventory/items/:kind/:id', (kind, id) => ({
      params: { kind, id },
    })),
    expiry: get('/v1/inventory/expiry'),
    movements: get('/v1/inventory/movements', (limit) => ({
      query: { limit },
    })),
    transfer: post('/v1/inventory/transfers', body),
    disposeLot: post('/v1/inventory/lots/:id/dispose', (id, note) => ({
      params: { id },
      body: { note },
    })),
    openLot: post('/v1/inventory/lots/:id/open', byId),
    receiveLot: post('/v1/inventory/lots', body),
    adjustLot: post('/v1/inventory/lots/:id/adjust', idBody),
    quarantineLot: post('/v1/inventory/lots/:id/quarantine', (id, note) => ({
      params: { id },
      body: { note },
    })),
    releaseLot: post('/v1/inventory/lots/:id/release', (id, note) => ({
      params: { id },
      body: { note },
    })),
    markLotExpired: post('/v1/inventory/lots/:id/expire', byId),
    receiveConsumable: post('/v1/inventory/consumables/:id/receive', idBody),
    adjustConsumable: post('/v1/inventory/consumables/:id/adjust', idBody),
  },
  equipment: {
    list: get('/v1/equipment', filters),
    get: get('/v1/equipment/:id', byId),
    log: post('/v1/equipment/:id/log', idBody),
    scheduleMaintenance: post('/v1/equipment/:id/maintenance', idBody),
    completeMaintenance: post('/v1/equipment/:id/maintenance/complete', idBody),
    recordCalibration: post('/v1/equipment/:id/calibrations', idBody),
    setConnection: post('/v1/equipment/:id/connection', idBody),
  },
  qc: {
    get: get('/v1/qc', filters),
    record: post('/v1/qc/runs', body),
    advanceEvent: post('/v1/qc/events/:id/advance', (id, note) => ({
      params: { id },
      body: { note },
    })),
  },
  tat: {
    get: get('/v1/tat', (range) => ({ query: { range } })),
  },
  analytics: {
    report: get('/v1/analytics/report', filters),
    get: get('/v1/analytics', (days) => ({ query: { days } })),
  },
  departments: {
    list: get('/v1/departments'),
    get: get('/v1/departments/:id', byId),
  },
  search: {
    resolve: get('/v1/search/resolve', (term) => ({ query: { term } })),
    query: get('/v1/search', (q) => ({ query: { q } })),
  },
  notifications: {
    list: get('/v1/notifications'),
    markRead: post('/v1/notifications/read', (ids) => ({ body: { ids } })),
    markSummaryRead: post(
      '/v1/notifications/summaries/:key/read',
      (key, count) => ({ params: { key }, body: { count } }),
    ),
    markAllRead: post('/v1/notifications/read-all'),
  },
  reference: {
    get: get('/v1/reference'),
  },
  system: {
    settings: get('/v1/settings'),
    updateSettings: patch('/v1/settings', body),
  },
  admin: {
    audit: get('/v1/audit', filters),
    recordAccess: post('/v1/audit/access', body),
    updateSignatory: put('/v1/staff/:id/signatory', idBody),
  },
  today: {
    get: get('/v1/today'),
    calendar: get('/v1/today/calendar', filters),
  },
  assistant: {
    suggestions: get('/v1/assistant/suggestions'),
    ask: post('/v1/assistant/ask', body),
  },
  imaging: {
    overview: get('/v1/imaging/overview'),
    list: get('/v1/imaging/studies', filters),
    report: get('/v1/imaging/studies/:id/report', (id, options) => ({
      params: { id },
      query: { ...options },
    })),
    createShareLink: post('/v1/imaging/studies/:id/share-links', idBody),
    revokeShareLink: post('/v1/imaging/share-links/:id/revoke', byId),
  },
  billing: {
    list: get('/v1/invoices', filters),
    get: get('/v1/invoices/:id', byId),
    forOrder: get('/v1/orders/:id/invoice', byId),
    create: post('/v1/invoices', body),
    requestDiscount: post('/v1/invoices/:id/discount', idBody),
    approveDiscount: post(
      '/v1/invoices/:id/discount/decision',
      (id, approve) => ({
        params: { id },
        body: { approve },
      }),
    ),
    pay: post('/v1/invoices/:id/payments', idBody),
    refund: post('/v1/invoices/:id/refunds', idBody),
    cancel: post('/v1/invoices/:id/cancel', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    dayBook: get('/v1/billing/day-book', (day) => ({ query: { day } })),
    closeDay: post('/v1/billing/day-close', body),
    masters: get('/v1/billing/masters'),
    savePackage: put('/v1/billing/packages', body),
    saveAccount: put('/v1/billing/accounts', body),
    savePriceList: put('/v1/billing/price-lists', body),
  },
  network: {
    masters: get('/v1/network'),
    saveDoctor: put('/v1/doctors', body),
    saveCentre: put('/v1/collection-centres', body),
    homeVisits: get('/v1/home-visits', filters),
    bookHomeVisit: post('/v1/home-visits', body),
    assignHomeVisit: post(
      '/v1/home-visits/:id/assign',
      (id, phlebotomistId) => ({
        params: { id },
        body: { phlebotomistId },
      }),
    ),
    updateHomeVisit: post('/v1/home-visits/:id/state', idBody),
    messaging: get('/v1/messaging'),
    saveTemplate: put('/v1/messaging/templates', body),
    setOptOut: put(
      '/v1/patients/:id/messaging-opt-out',
      (id, channel, optOut) => ({
        params: { id },
        body: { channel, optOut },
      }),
    ),
  },
  doctor: {
    patients: get('/v1/doctor/patients', filters),
    patient: get('/v1/doctor/patients/:id', byId),
  },
  quality: {
    overview: get('/v1/quality'),
    eqa: get('/v1/quality/eqa'),
    submitEqa: post('/v1/quality/eqa/:id/submission', (id, value) => ({
      params: { id },
      body: { value },
    })),
    evaluateEqa: post('/v1/quality/eqa/:id/evaluation', idBody),
    ncs: get('/v1/quality/nonconformances'),
    raiseNc: post('/v1/quality/nonconformances', body),
    advanceNc: post('/v1/quality/nonconformances/:id/step', idBody),
    documents: get('/v1/quality/documents'),
    createDocument: post('/v1/quality/documents', body),
    reviseDocument: post(
      '/v1/quality/documents/:id/revisions',
      (id, summary) => ({
        params: { id },
        body: { summary },
      }),
    ),
    submitDocument: post('/v1/quality/documents/:id/submit', byId),
    approveDocument: post('/v1/quality/documents/:id/approve', byId),
    returnDocument: post('/v1/quality/documents/:id/return', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    retireDocument: post('/v1/quality/documents/:id/retire', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    audits: get('/v1/quality/audits'),
    planAudit: post('/v1/quality/audits', body),
    startAudit: post('/v1/quality/audits/:id/start', byId),
    addFinding: post('/v1/quality/audits/:id/findings', idBody),
    completeAudit: post('/v1/quality/audits/:id/complete', (id, summary) => ({
      params: { id },
      body: { summary },
    })),
    risks: get('/v1/quality/risks'),
    saveRisk: put('/v1/quality/risks', body),
    lisVerifications: get('/v1/quality/lis-verifications'),
    runLisVerification: post('/v1/quality/lis-verifications', (note) => ({
      body: { note },
    })),
    reviewLisVerification: post(
      '/v1/quality/lis-verifications/:id/review',
      byId,
    ),
    uncertainty: get('/v1/quality/uncertainty'),
    qualifications: get('/v1/equipment-qualifications', (equipmentId) => ({
      query: { equipmentId },
    })),
    recordQualification: post('/v1/equipment-qualifications', body),
    coldUnits: get('/v1/cold-units'),
    saveColdUnit: put('/v1/cold-units', body),
    recordTemperature: post('/v1/cold-units/:id/readings', idBody),
  },
  registers: {
    formIII: get('/v1/registers/form-iii', (month, query) => ({
      query: { month, ...query },
    })),
    daily: get('/v1/registers/daily-results', (day, query) => ({
      query: { day, ...query },
    })),
    iqc: get('/v1/registers/iqc', (month, query) => ({
      query: { month, ...query },
    })),
    collection: get('/v1/registers/collection', (day, query) => ({
      query: { day, ...query },
    })),
  },
  privacy: {
    overview: get('/v1/privacy'),
    logRequest: post('/v1/privacy/requests', body),
    advanceRequest: post('/v1/privacy/requests/:id/step', idBody),
    logBreach: post('/v1/privacy/incidents', body),
    updateBreach: post('/v1/privacy/incidents/:id/step', (id, step, note) => ({
      params: { id },
      body: { step, note },
    })),
    placeHold: post('/v1/privacy/legal-holds', body),
    releaseHold: post('/v1/privacy/legal-holds/:id/release', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
    saveRetention: put('/v1/privacy/retention', body),
  },
  interfaces: {
    overview: get('/v1/interfaces'),
    saveMapping: put('/v1/interfaces/mappings', body),
    retry: post('/v1/interfaces/messages/:id/retry', byId),
  },
  sites: {
    list: get('/v1/sites'),
    save: put('/v1/sites', body),
  },
  autoVerify: {
    rules: get('/v1/autoverify/rules'),
    draft: post('/v1/autoverify/rules', body),
    approve: post('/v1/autoverify/rules/:id/approve', byId),
    retire: post('/v1/autoverify/rules/:id/retire', (id, reason) => ({
      params: { id },
      body: { reason },
    })),
  },
  insights: {
    list: get('/v1/insights'),
    feedback: post('/v1/insights/:key/feedback', (key, kind, reason) => ({
      params: { key },
      body: { kind, reason },
    })),
  },
  portal: {
    // Public routes (no session): rate-limit them and log every attempt.
    open: post('/v1/public/share/:token', (token, input) => ({
      params: { token },
      body: input,
    })),
    verify: get('/v1/public/verify/:token', (token) => ({
      params: { token },
    })),
  },
}
