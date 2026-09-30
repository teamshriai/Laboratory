import { itemTat } from '@/domain/tat'
import type { CancelReason, OrderStatus, Priority } from '@/domain/types'
import { ORDER_STATUSES } from '@/domain/types'
import { must } from '../engine/core'
import {
  addTests,
  cancelOrder,
  createOrder,
  discardDraft,
  removeItem,
  setPriority,
  submitDraft,
  updateDraft,
  type OrderInput,
} from '../engine/orders'
import { read, write } from './runtime'
import type {
  OrderDetail,
  OrderFilters,
  OrderItemDetail,
  OrderListResult,
  OrderRow,
} from './types'
import {
  inDateRange,
  matchesQuery,
  orderRow,
  patientSearchFields,
  sampleRow,
  staffName,
  testChip,
} from './views'
import { deriveReportStatus } from '@/domain/workflow'

export type { OrderInput }

export const ordersApi = {
  list: (filters: OrderFilters = {}) =>
    read((db, { index, now }): OrderListResult => {
      const rows: OrderRow[] = []
      for (const order of Object.values(db.orders)) {
        const at = order.orderedAt ?? order.createdAt
        if (!inDateRange(at, filters.date, now)) continue
        if (filters.patientId && order.patientId !== filters.patientId) continue
        if (filters.priority && order.priority !== filters.priority) continue
        if (filters.doctorId && order.doctorId !== filters.doctorId) continue
        if (filters.encounter && order.encounter !== filters.encounter) continue
        const patient = db.patients[order.patientId]!
        const row = orderRow(db, index, order, now)
        if (filters.department && !row.departments.includes(filters.department))
          continue
        if (
          filters.testId &&
          !row.tests.some((t) => t.testId === filters.testId)
        )
          continue
        if (
          !matchesQuery(filters.q, [
            ...patientSearchFields(patient),
            order.orderNo,
            ...row.tests.map((t) => t.shortName),
            ...(index.samplesByOrder.get(order.id) ?? []).map(
              (s) => s.accessionNo,
            ),
          ])
        )
          continue
        rows.push(row)
      }
      const counts = Object.fromEntries([
        ['all', 0],
        ...ORDER_STATUSES.map((s) => [s, 0]),
      ]) as Record<OrderStatus | 'all', number>
      for (const row of rows) {
        counts[row.status] += 1
        if (row.status !== 'draft') counts.all += 1
      }
      const status = filters.status ?? 'all'
      const filtered = rows.filter((r) =>
        status === 'all' ? r.status !== 'draft' : r.status === status,
      )
      return {
        rows: filtered.toSorted(
          (a, b) => (b.orderedAt ?? b.createdAt) - (a.orderedAt ?? a.createdAt),
        ),
        counts,
      }
    }),

  get: (id: string) =>
    read((db, { index, now }): OrderDetail => {
      const order = must(db.orders, id, 'order')
      const row = orderRow(db, index, order, now)
      const items = (index.itemsByOrder.get(id) ?? []).map(
        (item): OrderItemDetail => {
          const sample = item.sampleId ? db.samples[item.sampleId] : undefined
          const detail: OrderItemDetail = {
            ...testChip(db, item),
            price: item.price,
            tatHours: item.tatHours,
            specimen: item.specimen,
            container: item.container,
            sampleId: item.sampleId,
            accessionNo: sample?.accessionNo ?? null,
            sampleStatus: sample?.status ?? null,
            reportId: item.reportId,
            tat:
              item.active && item.status !== 'void'
                ? itemTat(item, sample, now)
                : null,
          }
          if (item.enteredAt) detail.enteredAt = item.enteredAt
          if (item.enteredBy) detail.enteredBy = staffName(db, item.enteredBy)
          if (item.validatedAt) detail.validatedAt = item.validatedAt
          if (item.validatedBy)
            detail.validatedBy = staffName(db, item.validatedBy)
          if (item.cancelReason) detail.cancelReason = item.cancelReason
          return detail
        },
      )
      const detail: OrderDetail = {
        ...row,
        clinicalNotes: order.clinicalNotes,
        createdBy: staffName(db, order.createdBy),
        history: order.history.toSorted((a, b) => b.at - a.at),
        items,
        samples: (index.samplesByOrder.get(id) ?? []).map((s) =>
          sampleRow(db, index, s, now),
        ),
        reports: (index.reportsByOrder.get(id) ?? []).map((r) => ({
          id: r.id,
          reportNo: r.reportNo,
          department: r.department,
          status: deriveReportStatus(r, index.itemsByReport.get(r.id) ?? []),
        })),
      }
      if (order.cancelReason) detail.cancelReason = order.cancelReason
      if (order.cancelRemarks) detail.cancelRemarks = order.cancelRemarks
      if (order.draftTestIds) detail.draftTestIds = order.draftTestIds
      return detail
    }),

  create: (input: OrderInput) =>
    write((db, ctx) => {
      const o = createOrder(db, { ...input, draft: false }, ctx)
      return {
        id: o.id,
        orderNo: o.orderNo,
        sampleIds: Object.values(db.samples)
          .filter((s) => s.orderId === o.id)
          .map((s) => s.id),
      }
    }),

  saveDraft: (input: OrderInput, draftId?: string) =>
    write((db, ctx) => {
      const o = draftId
        ? updateDraft(db, draftId, input, ctx)
        : createOrder(db, { ...input, draft: true }, ctx)
      return { id: o.id }
    }),

  submitDraft: (draftId: string, input: OrderInput) =>
    write((db, ctx) => {
      const o = submitDraft(db, draftId, input, ctx)
      return {
        id: o.id,
        orderNo: o.orderNo,
        sampleIds: Object.values(db.samples)
          .filter((s) => s.orderId === o.id)
          .map((s) => s.id),
      }
    }),

  discardDraft: (draftId: string) =>
    write((db) => void discardDraft(db, draftId)),

  cancel: (id: string, input: { reason: CancelReason; remarks?: string }) =>
    write((db, ctx) => void cancelOrder(db, id, input, ctx)),

  setPriority: (id: string, priority: Priority) =>
    write((db, ctx) => void setPriority(db, id, priority, ctx)),

  addTests: (id: string, testIds: string[]) =>
    write((db, ctx) => void addTests(db, id, testIds, ctx)),

  removeTest: (itemId: string, reason: CancelReason) =>
    write((db, ctx) => void removeItem(db, itemId, { reason }, ctx)),
}
