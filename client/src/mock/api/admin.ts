// Administration read models: the audit log viewer and the staff list.

import { AUDIT_ENTITIES, type AuditEntity } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { read, write } from './runtime'
import type { AuditFilters, AuditList, AuditRow } from './types'
import { inDateRange, matchesQuery, staffName } from './views'
import { paginate, type Sorters } from './paging'
import { recordAccess, type AccessInput } from '../engine/access'
import { updateSignatory, type SignatoryInput } from '../engine/staff'

/** Quality, privacy and interface records: their number and screen. */
function describeRecord(
  db: LabDb,
  entity: 'quality' | 'privacy' | 'interface',
  id: string,
): { label: string; link?: string } {
  if (entity === 'interface') {
    const eq = db.equipment[id]
    return eq ? { label: eq.name, link: '/interfaces' } : { label: id }
  }
  return { label: id, link: entity === 'quality' ? '/quality' : '/privacy' }
}

/** A human label and an app link for the record an entry is about. */
function describe(
  db: LabDb,
  entity: AuditEntity,
  id: string,
): { label: string; link?: string } {
  switch (entity) {
    case 'patient': {
      const p = db.patients[id]
      return p
        ? { label: `${p.name} · ${p.uhid}`, link: `/patients/${p.id}` }
        : { label: id }
    }
    case 'order': {
      const o = db.orders[id]
      return o
        ? { label: o.orderNo ?? id, link: `/orders?order=${o.id}` }
        : { label: id }
    }
    case 'sample': {
      const s = db.samples[id]
      return s
        ? { label: s.accessionNo ?? id, link: `/specimens/${s.id}` }
        : { label: id }
    }
    case 'result': {
      const item = db.items[id]
      const sample = item?.sampleId ? db.samples[item.sampleId] : undefined
      return item
        ? {
            label: `${item.testName}${sample?.accessionNo ? ` · ${sample.accessionNo}` : ''}`,
            ...(sample ? { link: `/specimens/${sample.id}` } : {}),
          }
        : { label: id }
    }
    case 'critical': {
      const c = db.criticals[id]
      return c
        ? {
            label: `${db.analytes[c.analyteId]?.name ?? c.analyteId} ${c.value} · ${db.patients[c.patientId]?.name ?? ''}`,
            link: `/critical-results?status=all&alert=${c.id}`,
          }
        : { label: id }
    }
    case 'report': {
      const r = db.reports[id]
      return r ? { label: r.reportNo, link: `/reports/${r.id}` } : { label: id }
    }
    case 'lot': {
      const l = db.lots[id]
      return l
        ? {
            label: `${db.reagents[l.reagentId]?.name ?? ''} · ${l.lotNumber}`,
            link: `/reagents?lot=${l.id}`,
          }
        : { label: id }
    }
    case 'consumable': {
      const c = db.consumables[id]
      return c
        ? { label: c.name, link: `/consumables?item=${c.id}` }
        : { label: id }
    }
    case 'equipment': {
      const e = db.equipment[id]
      return e
        ? { label: e.name, link: `/equipment?equipment=${e.id}` }
        : { label: id }
    }
    case 'qc': {
      const ev = db.qcEvents[id]
      return ev
        ? {
            label: `${db.equipment[ev.equipmentId]?.name ?? ''} · ${db.analytes[ev.analyteId]?.name ?? ''}`,
            link: `/quality-control?event=${ev.id}`,
          }
        : { label: id }
    }
    case 'test': {
      const t = db.tests[id]
      return t
        ? { label: `${t.name} (${t.code})`, link: `/test-catalog?test=${t.id}` }
        : { label: id }
    }
    case 'analyte': {
      const a = db.analytes[id]
      return a ? { label: a.name, link: '/test-catalog' } : { label: id }
    }
    case 'settings':
      return { label: '', link: '/settings?section=laboratory' }
    case 'system':
      return { label: '' }
    case 'imaging': {
      const study = db.imaging[id]
      return study
        ? {
            label: `${study.examName} · ${study.reportNo ?? study.accessionNo}`,
            link: `/imaging/reports/${study.id}`,
          }
        : { label: id }
    }
    case 'quality':
    case 'privacy':
    case 'interface':
      return describeRecord(db, entity, id)
    case 'invoice': {
      // Invoices, and billing records filed under them (packages, accounts,
      // price lists, the day's close).
      const invoice = db.invoices[id]
      if (invoice)
        return {
          label: `${invoice.invoiceNo} · ${db.patients[invoice.patientId]?.name ?? ''}`,
          link: `/billing/${invoice.id}`,
        }
      const named =
        db.packages[id]?.name ??
        db.accounts[id]?.name ??
        db.priceLists[id]?.name ??
        (db.cashCloses[id] ? id : undefined)
      return { label: named ?? id }
    }
  }
}

const AUDIT_SORTERS: Sorters<AuditRow> = {
  time: (r) => r.at,
  action: (r) => r.action,
  user: (r) => r.byName,
}

export const adminApi = {
  /** Adds, changes or (with null) removes a person's signatory registration. */
  updateSignatory: (staffId: string, input: SignatoryInput | null) =>
    write((db, ctx) => void updateSignatory(db, staffId, input, ctx)),
  /** Records a view, print or export of personal health information. */
  recordAccess: (input: AccessInput) =>
    write((db, ctx) => recordAccess(db, input, ctx)),
  /** The append-only audit log, newest first (read only: there is no edit). */
  audit: (filters: AuditFilters = {}) =>
    read((db, { now }): AuditList => {
      const rows: AuditRow[] = []
      const actions = new Set<string>()
      for (const entry of db.audit) {
        actions.add(entry.action)
        if (filters.entity && entry.entity !== filters.entity) continue
        if (filters.action && entry.action !== filters.action) continue
        if (filters.by && entry.by !== filters.by) continue
        if (!inDateRange(entry.at, filters.date, now)) continue
        const record = describe(db, entry.entity, entry.entityId)
        const byName = staffName(db, entry.by)
        if (
          !matchesQuery(filters.q, [
            record.label,
            byName,
            entry.reason,
            entry.from,
            entry.to,
            ...Object.values(entry.detail ?? {}).map(String),
          ])
        )
          continue
        rows.push({ ...entry, byName, record })
      }
      return {
        ...paginate(rows, filters, AUDIT_SORTERS),
        total: db.audit.length,
        entities: [...AUDIT_ENTITIES],
        actions: [...actions].toSorted(),
      }
    }, 'search'),
}
