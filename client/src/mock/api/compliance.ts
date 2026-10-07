// Privacy (DPDP), analyser interfaces and coding, sites, auto-verification
// rules and the rule-based insights with their feedback.

import { boardDue, certInDue, ucumFor } from '@/domain/quality'
import { DAY, istHour } from '@/domain/time'
import type {
  AutoVerifyCheck,
  BreachStep,
  InsightFeedbackKind,
  RetentionRule,
  Site,
} from '@/domain/types'
import { INSIGHT_FEEDBACK } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { audit, LabApiError, requirePermission } from '../engine/core'
import { approveRule, draftRule, retireRule } from '../engine/autoverify'
import {
  mappingFor,
  retryMessage,
  saveCodeMapping,
  saveSite,
} from '../engine/interfaces'
import {
  activeHold,
  advanceDataRequest,
  logBreach,
  logDataRequest,
  placeHold,
  releaseHold,
  saveRetention,
  updateBreach,
  type BreachInput,
  type DataRequestInput,
} from '../engine/privacy'
import { MAX_FEED_ENTRIES } from '../db/schema'
import { read, write } from './runtime'
import type {
  AutoVerifyRuleRow,
  BreachRow,
  CodingRow,
  DataRequestRow,
  Insight,
  InterfaceOverview,
  InterfaceRow,
  LegalHoldRow,
  PrivacyOverview,
  SiteRow,
} from './types'
import { staffName } from './views'

const withNames = <T extends { by: string }>(db: LabDb, rows: T[]) =>
  rows.map((h) => ({ ...h, byName: staffName(db, h.by) }))

function holdLabel(db: LabDb, entity: 'patient' | 'report', id: string) {
  if (entity === 'patient') {
    const p = db.patients[id]
    return { label: p ? `${p.name} · ${p.uhid}` : id, link: `/patients/${id}` }
  }
  const r = db.reports[id]
  return { label: r?.reportNo ?? id, link: `/reports/${id}` }
}

export const privacyApi = {
  overview: () =>
    read((db, { now }): PrivacyOverview => ({
      requests: Object.values(db.dataRequests)
        .toSorted((a, b) => b.receivedAt - a.receivedAt)
        .map((r): DataRequestRow => ({
          ...r,
          ...(r.patientId && db.patients[r.patientId]
            ? { patientName: db.patients[r.patientId]!.name }
            : {}),
          overdue: !r.closedAt && r.dueAt < now,
          onHold: Boolean(
            r.patientId && activeHold(db, 'patient', r.patientId),
          ),
          history: withNames(db, r.history),
        })),
      breaches: Object.values(db.breaches)
        .toSorted((a, b) => b.detectedAt - a.detectedAt)
        .map((b): BreachRow => {
          const certInDueAt = certInDue(b.detectedAt)
          const boardDueAt = boardDue(b.detectedAt)
          return {
            ...b,
            detectedByName: staffName(db, b.detectedBy),
            certInDueAt,
            boardDueAt,
            certInLate: (b.certInReportedAt ?? now) > certInDueAt,
            boardLate: (b.boardReportedAt ?? now) > boardDueAt,
            history: withNames(db, b.history),
          }
        }),
      holds: Object.values(db.legalHolds)
        .toSorted((a, b) => b.placedAt - a.placedAt)
        .map((h): LegalHoldRow => ({
          ...h,
          ...holdLabel(db, h.entity, h.entityId),
          placedByName: staffName(db, h.placedBy),
          ...(h.releasedBy
            ? { releasedByName: staffName(db, h.releasedBy) }
            : {}),
        })),
      retention: db.settings.retention,
      dataRequestDays: db.settings.dataRequestDays,
      grievanceOfficer: db.settings.profile.grievanceOfficer,
    })),
  logRequest: (input: DataRequestInput) =>
    write((db, ctx) => logDataRequest(db, input, ctx).id),
  advanceRequest: (
    id: string,
    input: Parameters<typeof advanceDataRequest>[2],
  ) => write((db, ctx) => void advanceDataRequest(db, id, input, ctx)),
  logBreach: (input: BreachInput) =>
    write((db, ctx) => logBreach(db, input, ctx).id),
  updateBreach: (id: string, step: BreachStep, note: string) =>
    write((db, ctx) => void updateBreach(db, id, step, note, ctx)),
  placeHold: (input: Parameters<typeof placeHold>[1]) =>
    write((db, ctx) => placeHold(db, input, ctx).id),
  releaseHold: (id: string, reason: string) =>
    write((db, ctx) => void releaseHold(db, id, reason, ctx)),
  saveRetention: (rules: RetentionRule[]) =>
    write((db, ctx) => void saveRetention(db, rules, ctx)),
}

// ---------- Interfaces ----------

function analytesOf(db: LabDb, equipmentId: string) {
  const eq = db.equipment[equipmentId]
  return [
    ...new Set(eq?.testIds.flatMap((t) => db.tests[t]?.analyteIds ?? [])),
  ].filter((a) => db.analytes[a]?.resultType === 'numeric')
}

export const interfacesApi = {
  overview: () =>
    read((db, { now }): InterfaceOverview => {
      const mapped = Object.values(db.codeMappings)
      const equipmentIds = new Set(mapped.map((m) => m.equipmentId))
      const interfaces = [...equipmentIds]
        .map((id) => db.equipment[id])
        .filter((e) => e !== undefined)
        .map((eq): InterfaceRow => {
          const msgs = db.interfaceLog.filter((m) => m.equipmentId === eq.id)
          const analytes = analytesOf(db, eq.id)
          const current = new Set(
            analytes.filter((a) =>
              mapped.some((m) => m.equipmentId === eq.id && m.analyteId === a),
            ),
          )
          return {
            equipmentId: eq.id,
            name: eq.name,
            department: eq.department,
            connection: eq.connection ?? 'online',
            protocol: eq.manufacturer.includes('Sysmex') ? 'HL7' : 'ASTM',
            messagesToday: msgs.filter((m) => m.at > now - DAY).length,
            errors: msgs.filter((m) => m.state === 'error').length,
            lastMessageAt: msgs[0]?.at ?? null,
            mapped: current.size,
            unmapped: analytes
              .filter((a) => !current.has(a))
              .map((a) => db.analytes[a]?.name ?? a),
          }
        })
        .toSorted((a, b) => b.errors - a.errors || a.name.localeCompare(b.name))
      const coding = Object.values(db.analytes)
        .filter((a) => a.resultType === 'numeric')
        .map((a): CodingRow => ({
          analyteId: a.id,
          name: a.name,
          unit: a.unit,
          testNames: Object.values(db.tests)
            .filter((t) => t.analyteIds.includes(a.id))
            .map((t) => t.name),
          loinc: a.loinc ?? null,
          ucum: ucumFor(a.unit),
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name))
      return {
        interfaces,
        messages: db.interfaceLog.slice(0, 200).map((m) => {
          const sample = m.accessionNo
            ? Object.values(db.samples).find(
                (x) => x.accessionNo === m.accessionNo,
              )
            : undefined
          return {
            ...m,
            equipmentName: db.equipment[m.equipmentId]?.name ?? m.equipmentId,
            ...(sample ? { sampleId: sample.id } : {}),
          }
        }),
        mappings: mapped
          .filter(
            (m) => mappingFor(db, m.equipmentId, m.instrumentCode)?.id === m.id,
          )
          .toSorted(
            (a, b) =>
              a.equipmentId.localeCompare(b.equipmentId) ||
              a.instrumentCode.localeCompare(b.instrumentCode),
          )
          .map((m) => ({
            ...m,
            analyteName: db.analytes[m.analyteId]?.name ?? m.analyteId,
            updatedByName: staffName(db, m.updatedBy),
          })),
        coding,
        coverage: {
          analytes: coding.length,
          loinc: coding.filter((c) => c.loinc).length,
          ucum: coding.filter((c) => c.ucum).length,
        },
      }
    }),
  saveMapping: (input: Parameters<typeof saveCodeMapping>[1]) =>
    write((db, ctx) => saveCodeMapping(db, input, ctx).id),
  retry: (messageId: string) =>
    write((db, ctx) => retryMessage(db, messageId, ctx).state),
}

// ---------- Sites ----------

export const sitesApi = {
  list: () =>
    read((db, { now }): SiteRow[] => {
      const main = Object.values(db.sites).find((s) => s.kind === 'main')
      const counts = new Map<string, number>()
      for (const o of Object.values(db.orders))
        if ((o.orderedAt ?? 0) > now - 30 * DAY) {
          const site = o.siteId ?? main?.id ?? ''
          counts.set(site, (counts.get(site) ?? 0) + 1)
        }
      return Object.values(db.sites)
        .toSorted(
          (a, b) =>
            Number(b.kind === 'main') - Number(a.kind === 'main') ||
            a.name.localeCompare(b.name),
        )
        .map((s) => ({ ...s, orders30d: counts.get(s.id) ?? 0 }))
    }),
  save: (input: Omit<Site, 'id'> & { id?: string }) =>
    write((db, ctx) => saveSite(db, input, ctx).id),
}

// ---------- Auto-verification ----------

export const autoVerifyApi = {
  rules: () =>
    read((db, { now }): AutoVerifyRuleRow[] =>
      Object.values(db.autoVerifyRules)
        .toSorted(
          (a, b) =>
            (db.tests[a.testId]?.name ?? '').localeCompare(
              db.tests[b.testId]?.name ?? '',
            ) || b.version - a.version,
        )
        .map((r) => ({
          ...r,
          testName: db.tests[r.testId]?.name ?? r.testId,
          createdByName: staffName(db, r.createdBy),
          ...(r.approvedBy
            ? { approvedByName: staffName(db, r.approvedBy) }
            : {}),
          reviewDue:
            r.state === 'approved' &&
            r.approvedAt !== undefined &&
            r.approvedAt < now - 365 * DAY,
        })),
    ),
  draft: (input: {
    testId: string
    checks: AutoVerifyCheck[]
    note?: string
  }) => write((db, ctx) => draftRule(db, input, ctx).id),
  approve: (id: string) => write((db, ctx) => void approveRule(db, id, ctx)),
  retire: (id: string, reason: string) =>
    write((db, ctx) => void retireRule(db, id, reason, ctx)),
}

// ---------- Insights ----------

const RULE_VERSION = 'insight-rules 1.0'

/**
 * Rule-based suggestions from the lab's own data. Each says why, over
 * which window and from which records, so a person can check it.
 */
function insightsFor(db: LabDb, now: number, actor: string): Insight[] {
  const out: Insight[] = []
  const week = now - 7 * DAY
  const lastWeek = now - 14 * DAY

  // 1. Rejections rising (last 7 days against the 7 before).
  const rejected = (from: number, to: number) =>
    Object.values(db.samples).filter(
      (s) => s.rejection && s.rejection.at > from && s.rejection.at <= to,
    ).length
  const collected = (from: number, to: number) =>
    Object.values(db.samples).filter(
      (s) => s.collectedAt && s.collectedAt > from && s.collectedAt <= to,
    ).length
  const recentRej = rejected(week, now)
  const priorRej = rejected(lastWeek, week)
  const recentCol = collected(week, now)
  const recentPct = recentCol ? (recentRej / recentCol) * 100 : 0
  if (recentRej >= 3 && recentPct > db.settings.qualityTargets.rejectionPct)
    out.push({
      key: `rejection-rise:${Math.floor(now / DAY)}`,
      kind: 'rejection-rise',
      params: {
        rate: Math.round(recentPct * 10) / 10,
        target: db.settings.qualityTargets.rejectionPct,
        count: recentRej,
      },
      confidence: recentRej >= 8 ? 'high' : 'medium',
      why: [
        {
          kind: 'rejected-count',
          params: { recent: recentRej, prior: priorRej },
        },
        { kind: 'collected-count', params: { count: recentCol } },
      ],
      window: { from: week, to: now },
      sources: [{ label: 'reception', link: '/reception?status=rejected' }],
      ruleVersion: RULE_VERSION,
      generatedAt: now,
    })

  // 2. QC shift: the last four runs of a control on one side of the mean
  //    beyond 1 SD (the 4-1s pattern building).
  const byControl = new Map<string, LabDb['qcRuns'][string][]>()
  for (const r of Object.values(db.qcRuns))
    byControl.set(`${r.equipmentId}|${r.analyteId}|${r.level}`, [
      ...(byControl.get(`${r.equipmentId}|${r.analyteId}|${r.level}`) ?? []),
      r,
    ])
  for (const [key, runs] of byControl) {
    const last = runs.toSorted((a, b) => b.at - a.at).slice(0, 4)
    if (last.length < 4) continue
    const z = last.map((r) => (r.value - r.mean) / r.sd)
    const side = z.every((v) => v > 1) ? 1 : z.every((v) => v < -1) ? -1 : 0
    if (!side) continue
    const [equipmentId, analyteId, level] = key.split('|') as [
      string,
      string,
      string,
    ]
    out.push({
      key: `qc-shift:${key}:${last[0]!.id}`,
      kind: 'qc-shift',
      params: {
        analyte: db.analytes[analyteId]?.name ?? analyteId,
        equipment: db.equipment[equipmentId]?.name ?? equipmentId,
        level,
        direction: side > 0 ? 'high' : 'low',
      },
      confidence: 'medium',
      why: [{ kind: 'qc-runs', params: { count: 4, sd: 1 } }],
      window: { from: last.at(-1)!.at, to: last[0]!.at },
      sources: [
        {
          label: 'quality-control',
          link: `/quality-control?series=${encodeURIComponent(key)}`,
        },
      ],
      ruleVersion: RULE_VERSION,
      generatedAt: now,
    })
  }

  // 3. TAT breaches clustered in one two-hour window of the day.
  const stats = db.dailyStats.slice(-7)
  if (stats.length) {
    const hours = Array.from({ length: 24 }, (_, h) =>
      stats.reduce((n, d) => n + (d.byHour[h] ?? 0), 0),
    )
    const total = hours.reduce((a, b) => a + b, 0)
    let best = 0
    for (let h = 1; h < 23; h++)
      if (hours[h]! + hours[h + 1]! > hours[best]! + hours[best + 1]!) best = h
    const share = total ? ((hours[best]! + hours[best + 1]!) / total) * 100 : 0
    const delayed = stats.reduce((n, d) => n + d.delayedPct, 0) / stats.length
    if (share >= 18 && delayed > 100 - db.settings.qualityTargets.tatWithinPct)
      out.push({
        key: `tat-cluster:${best}:${Math.floor(now / DAY)}`,
        kind: 'tat-cluster',
        params: {
          from: `${String(best).padStart(2, '0')}:00`,
          to: `${String(best + 2).padStart(2, '0')}:00`,
          share: Math.round(share),
          delayed: Math.round(delayed * 10) / 10,
        },
        confidence: 'low',
        why: [
          { kind: 'peak-share', params: { share: Math.round(share) } },
          {
            kind: 'delayed-share',
            params: { pct: Math.round(delayed * 10) / 10 },
          },
        ],
        window: { from: now - 7 * DAY, to: now },
        sources: [{ label: 'tat', link: '/tat' }],
        ruleVersion: RULE_VERSION,
        generatedAt: now,
      })
  }

  // 4. Temperature excursions in the last 7 days.
  for (const unit of Object.values(db.coldUnits)) {
    const excursions = unit.readings.filter(
      (r) => r.outOfRange && r.at > now - 7 * DAY,
    )
    if (!excursions.length) continue
    out.push({
      key: `cold-excursion:${unit.id}:${excursions[0]!.id}`,
      kind: 'cold-excursion',
      params: {
        unit: unit.name,
        count: excursions.length,
        value: excursions[0]!.value,
        min: unit.min,
        max: unit.max,
      },
      confidence: 'high',
      why: [
        {
          kind: 'readings',
          params: { count: excursions.length, at: istHour(excursions[0]!.at) },
        },
      ],
      window: { from: now - 7 * DAY, to: now },
      sources: [
        { label: 'cold-storage', link: `/cold-storage?unit=${unit.id}` },
      ],
      ruleVersion: RULE_VERSION,
      generatedAt: now,
    })
  }

  const feedback = new Map<string, InsightFeedbackKind>()
  for (const f of db.insightFeedback.toReversed())
    if (f.by === actor) feedback.set(f.insightKey, f.kind)
  return out
    .map((i) => {
      const kind = feedback.get(i.key)
      return kind ? { ...i, feedback: kind } : i
    })
    .filter((i) => i.feedback !== 'dismissed' && i.feedback !== 'not-useful')
}

export const insightsApi = {
  list: () => read((db, { now, actor }) => insightsFor(db, now, actor)),
  feedback: (key: string, kind: InsightFeedbackKind, reason?: string) =>
    write((db, ctx) => {
      requirePermission(db, ctx, 'insight.feedback')
      if (!INSIGHT_FEEDBACK.includes(kind))
        throw new LabApiError('validation-failed', { field: 'kind' })
      const why = reason?.trim()
      if (kind === 'not-useful' && !why)
        throw new LabApiError('reason-required')
      db.insightFeedback.unshift({
        id: `if_${ctx.now.toString(36)}`,
        insightKey: key,
        kind,
        ...(why ? { reason: why } : {}),
        at: ctx.now,
        by: ctx.by,
      })
      if (db.insightFeedback.length > MAX_FEED_ENTRIES)
        db.insightFeedback.length = MAX_FEED_ENTRIES
      audit(db, ctx, 'system', 'insights', `insight-${kind}`, {
        ...(why ? { reason: why } : {}),
        detail: { insight: key.split(':')[0]!, rules: RULE_VERSION },
      })
    }),
}
