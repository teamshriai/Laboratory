// Referring doctors and collection centres (masters), home collection
// visits and the message outbox.

import { DAY, istDay } from '@/domain/time'
import { HOME_VISIT_STATES, type MessageChannel } from '@/domain/types'
import { LabApiError } from '../engine/core'
import {
  setMessagingOptOut,
  saveTemplate,
  type TemplateInput,
} from '../engine/messaging'
import {
  assignHomeVisit,
  bookHomeVisit,
  saveCentre,
  saveDoctor,
  updateHomeVisit,
  type BookVisitInput,
  type CentreInput,
  type DoctorInput,
} from '../engine/network'
import { read, write } from './runtime'
import type {
  HomeVisitFilters,
  HomeVisitList,
  HomeVisitRow,
  MessagingView,
  NetworkMasters,
} from './types'
import { patientSummary, staffName } from './views'

const dayKey = /^\d{4}-\d{2}-\d{2}$/

export const networkApi = {
  masters: () =>
    read((db, { now }): NetworkMasters => {
      const since = now - 30 * DAY
      const counts = new Map<string, number>()
      for (const o of Object.values(db.orders))
        if ((o.orderedAt ?? 0) >= since)
          counts.set(o.doctorId, (counts.get(o.doctorId) ?? 0) + 1)
      return {
        doctors: Object.values(db.doctors)
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((d) => ({ ...d, orders30d: counts.get(d.id) ?? 0 })),
        centres: Object.values(db.centres)
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({
            ...c,
            ...(c.accountId && db.accounts[c.accountId]
              ? { accountName: db.accounts[c.accountId]!.name }
              : {}),
          })),
      }
    }),
  saveDoctor: (input: DoctorInput) =>
    write((db, ctx) => saveDoctor(db, input, ctx).id),
  saveCentre: (input: CentreInput) =>
    write((db, ctx) => saveCentre(db, input, ctx).id),

  /** One day's home visits and each phlebotomist's route. */
  homeVisits: (filters: HomeVisitFilters = {}) =>
    read((db, { now }): HomeVisitList => {
      if (filters.day !== undefined && !dayKey.test(filters.day))
        throw new LabApiError('validation-failed', { field: 'day' })
      const day = filters.day ?? istDay(now)
      const ofDay = Object.values(db.homeVisits)
        .filter((v) => istDay(v.slotStart) === day)
        .toSorted((a, b) => a.slotStart - b.slotStart)
      const counts = Object.fromEntries([
        ['all', ofDay.length],
        ...HOME_VISIT_STATES.map((s) => [s, 0]),
      ]) as HomeVisitList['counts']
      for (const v of ofDay) counts[v.state] += 1
      const routes = new Map<string, string[]>()
      for (const v of ofDay)
        if (v.phlebotomistId && v.state !== 'cancelled')
          routes.set(v.phlebotomistId, [
            ...(routes.get(v.phlebotomistId) ?? []),
            v.id,
          ])
      const state = filters.state ?? 'all'
      const rows = ofDay
        .filter((v) => state === 'all' || v.state === state)
        .filter(
          (v) =>
            !filters.phlebotomistId ||
            v.phlebotomistId === filters.phlebotomistId,
        )
        .map((v): HomeVisitRow => {
          const order = v.orderId ? db.orders[v.orderId] : undefined
          return {
            ...v,
            patient: patientSummary(db.patients[v.patientId]!),
            ...(order ? { orderNo: order.orderNo } : {}),
            ...(v.phlebotomistId
              ? { phlebotomistName: staffName(db, v.phlebotomistId) }
              : {}),
            createdByName: staffName(db, v.createdBy),
            history: v.history.map((h) => ({
              ...h,
              byName: staffName(db, h.by),
            })),
          }
        })
      return {
        day,
        rows,
        counts,
        routes: [...routes.entries()].map(([staffId, visits]) => ({
          staffId,
          name: staffName(db, staffId),
          visits,
        })),
      }
    }),
  bookHomeVisit: (input: BookVisitInput) =>
    write((db, ctx) => bookHomeVisit(db, input, ctx).id),
  assignHomeVisit: (id: string, phlebotomistId: string) =>
    write((db, ctx) => void assignHomeVisit(db, id, phlebotomistId, ctx)),
  updateHomeVisit: (id: string, input: Parameters<typeof updateHomeVisit>[2]) =>
    write((db, ctx) => void updateHomeVisit(db, id, input, ctx)),

  messaging: () =>
    read((db): MessagingView => ({
      templates: Object.values(db.templates).toSorted(
        (a, b) =>
          a.event.localeCompare(b.event) ||
          a.channel.localeCompare(b.channel) ||
          a.language.localeCompare(b.language),
      ),
      outbox: db.outbox.slice(0, 200).map((m) => ({
        ...m,
        byName: staffName(db, m.by),
        ...(m.patientId && db.patients[m.patientId]
          ? { patientName: db.patients[m.patientId]!.name }
          : {}),
        ...(m.relatedId && db.reports[m.relatedId]
          ? { relatedLabel: db.reports[m.relatedId]!.reportNo }
          : {}),
      })),
    })),
  saveTemplate: (input: TemplateInput) =>
    write((db, ctx) => saveTemplate(db, input, ctx).id),
  setOptOut: (patientId: string, channel: MessageChannel, optOut: boolean) =>
    write(
      (db, ctx) => void setMessagingOptOut(db, patientId, channel, optOut, ctx),
    ),
}
