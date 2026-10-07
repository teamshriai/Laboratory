// Quality, compliance and integration rules (Wave 3): EQA scoring and
// CAPA, independent sign-off of documents, audits, LIS verification and
// auto-verification rules, temperature excursions, privacy deadlines and
// legal holds, interface retries, registers, settings and insights.

import { beforeEach, describe, expect, it } from 'vitest'
import { HOUR } from '@/domain/time'
import { modulesForTier } from '@/domain/modules'
import { getDb, startMemoryDb } from '../db/store'
import { applyAutoCheck } from '../engine/autoverify'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const manager = actingAs(STAFF.manager)
const pathologist = actingAs(STAFF.pathologist)
const tech = actingAs(STAFF.technician)
const biochem = actingAs(STAFF.biochemistry)
const desk = actingAs(STAFF.reception)
const owner = actingAs('st_vasanth')

describe('quality, compliance and integration', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('scores EQA and raises a non-conformance for an unacceptable result', async () => {
    const rounds = await labApi.quality.eqa()
    const failed = rounds.find((r) => r.outcome === 'unacceptable')!
    expect(Math.abs(failed.zScore!)).toBeGreaterThanOrEqual(3)
    expect(failed.ncNo).toMatch(/^NC-/)
    const open = rounds.find((r) => !r.submittedAt)!
    await expect(desk.quality.submitEqa(open.id, 10)).rejects.toMatchObject({
      code: 'not-permitted',
    })
    await tech.quality.submitEqa(open.id, 10)
    await expect(
      tech.quality.evaluateEqa(open.id, { targetValue: 10, targetSd: 1 }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    expect(
      await manager.quality.evaluateEqa(open.id, {
        targetValue: 10.5,
        targetSd: 1,
      }),
    ).toBe('acceptable')
  })

  it('walks CAPA step by step, with an independent effectiveness check', async () => {
    const id = await tech.quality.raiseNc({
      source: 'specimen',
      severity: 'minor',
      title: 'Unlabelled tubes from OPD',
      description: 'Three tubes arrived without labels.',
      department: 'hematology',
    })
    await expect(
      manager.quality.advanceNc(id, { to: 'action', rootCause: 'x' }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    await manager.quality.advanceNc(id, {
      to: 'investigating',
      ownerId: STAFF.manager,
      dueAt: Date.now() + 5 * 24 * HOUR,
    })
    await expect(
      manager.quality.advanceNc(id, { to: 'action' }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    await manager.quality.advanceNc(id, {
      to: 'action',
      rootCause: 'Label printer out of stock at OPD.',
    })
    await manager.quality.advanceNc(id, {
      to: 'verifying',
      correctiveAction: 'Spare label rolls kept at OPD.',
    })
    // The owner may not judge their own action effective.
    await expect(
      manager.quality.advanceNc(id, {
        to: 'closed',
        effective: true,
        note: 'ok',
      }),
    ).rejects.toMatchObject({ code: 'independent-approval' })
    await pathologist.quality.advanceNc(id, {
      to: 'action',
      effective: false,
      note: 'Two more unlabelled tubes this week.',
    })
    expect(getDb().ncs[id]!.state).toBe('action')
  })

  it('needs someone other than the author to authorise a document', async () => {
    const id = await tech.quality.createDocument({
      code: 'HM-09',
      title: 'Peripheral smear review',
      kind: 'sop',
      department: 'hematology',
      reviewMonths: 12,
      summary: 'When to review a smear.',
    })
    await tech.quality.submitDocument(id)
    await expect(tech.quality.approveDocument(id)).rejects.toMatchObject({
      code: 'not-permitted',
    })
    await manager.quality.approveDocument(id)
    await tech.quality.reviseDocument(id, 'Adds the blast flag.')
    await tech.quality.submitDocument(id)
    await pathologist.quality.approveDocument(id)
    const doc = (await labApi.quality.documents()).find((d) => d.id === id)!
    expect(doc.current?.version).toBe('2.0')
    expect(doc.versions[0]!.state).toBe('retired')

    const own = await manager.quality.createDocument({
      code: 'GEN-99',
      title: 'Test',
      kind: 'policy',
      department: 'all',
      reviewMonths: 12,
      summary: 'x',
    })
    await manager.quality.submitDocument(own)
    await expect(manager.quality.approveDocument(own)).rejects.toMatchObject({
      code: 'independent-approval',
    })
  })

  it('keeps auditors off their own department; a nonconformity raises an NC', async () => {
    await expect(
      manager.quality.planAudit({
        area: 'Biochemistry',
        clauses: '7.3',
        department: 'biochemistry',
        plannedFor: Date.now() + 24 * HOUR,
        auditorId: STAFF.biochemistry,
      }),
    ).rejects.toMatchObject({ code: 'auditor-not-independent' })
    const id = await manager.quality.planAudit({
      area: 'Haematology',
      clauses: '7.3',
      department: 'hematology',
      plannedFor: Date.now(),
      auditorId: STAFF.biochemistry,
    })
    await biochem.quality.startAudit(id)
    const before = Object.keys(getDb().ncs).length
    await biochem.quality.addFinding(id, {
      kind: 'nonconformity',
      clause: '7.3.7',
      text: 'IQC not run on the second shift.',
    })
    expect(Object.keys(getDb().ncs).length).toBe(before + 1)
  })

  it('verifies the LIS on ten specimens, reviewed by someone else', async () => {
    const id = await biochem.quality.runLisVerification()
    const run = getDb().lisVerifications[id]!
    expect(run.checks.length).toBeGreaterThanOrEqual(10)
    expect(new Set(run.checks.map((c) => c.accessionNo)).size).toBe(
      run.checks.length,
    )
    await expect(
      actingAs(STAFF.biochemistry).quality.reviewLisVerification(id),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await manager.quality.reviewLisVerification(id)
    const overview = await labApi.quality.overview()
    expect(overview.lisVerification.nextDueAt).toBeGreaterThan(Date.now())
    expect(overview.indicators).toHaveLength(6)
  })

  it('asks for the action taken when a temperature is out of range', async () => {
    const units = await labApi.quality.coldUnits()
    const fridge = units.find((u) => u.kind === 'refrigerator')!
    await expect(
      tech.quality.recordTemperature(fridge.id, { value: fridge.max + 3 }),
    ).rejects.toMatchObject({ code: 'action-required' })
    await tech.quality.recordTemperature(fridge.id, {
      value: fridge.max + 3,
      action: 'Moved reagents to refrigerator 1.',
    })
    const after = (await labApi.quality.coldUnits()).find(
      (u) => u.id === fridge.id,
    )!
    expect(after.latest?.outOfRange).toBe(true)
    // The excursion shows as an insight with its evidence.
    const insights = await labApi.insights.list()
    expect(insights.some((i) => i.kind === 'cold-excursion')).toBe(true)
  })

  it('blocks erasure under a legal hold and tracks breach deadlines', async () => {
    const privacy = await labApi.privacy.overview()
    const held = privacy.requests.find((r) => r.kind === 'erasure')!
    expect(held.onHold).toBe(true)
    await expect(
      tech.privacy.advanceRequest(held.id, { to: 'in-progress' }),
    ).rejects.toMatchObject({ code: 'not-permitted' })
    await manager.privacy.advanceRequest(held.id, { to: 'in-progress' })
    await expect(
      manager.privacy.advanceRequest(held.id, {
        to: 'completed',
        response: 'Deleted.',
      }),
    ).rejects.toMatchObject({ code: 'legal-hold' })

    const id = await owner.privacy.logBreach({
      title: 'Lost USB drive',
      description: 'A drive with a CSV export was lost.',
      detectedAt: Date.now() - 7 * HOUR,
      affectedCount: 40,
      dataKinds: 'Names, UHIDs',
    })
    const row = (await labApi.privacy.overview()).breaches.find(
      (b) => b.id === id,
    )!
    expect(row.certInLate).toBe(true)
    expect(row.boardLate).toBe(false)
    await expect(
      owner.privacy.updateBreach(id, 'closed', 'Done'),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
  })

  it('retries an interface message once its code is mapped', async () => {
    const overview = await labApi.interfaces.overview()
    const failed = overview.messages.find((m) => m.error === 'unmapped-code')!
    expect(await tech.interfaces.retry(failed.id)).toBe('error')
    const analyte = Object.values(getDb().analytes).find(
      (a) => a.resultType === 'numeric',
    )!
    await tech.interfaces.saveMapping({
      equipmentId: failed.equipmentId,
      instrumentCode: failed.instrumentCode!,
      analyteId: analyte.id,
    })
    expect(await tech.interfaces.retry(failed.id)).toBe('processed')
    expect(overview.coverage.loinc).toBeGreaterThan(30)
    expect(overview.coverage.ucum).toBeGreaterThan(
      overview.coverage.analytes / 2,
    )
  })

  it('marks auto-verified results only while switched on and with an approved rule', async () => {
    const rules = await labApi.autoVerify.rules()
    const draft = rules.find((r) => r.state === 'draft')!
    await expect(
      actingAs(draft.createdBy).autoVerify.approve(draft.id),
    ).rejects.toMatchObject({ code: 'independent-approval' })
    await expect(
      manager.autoVerify.draft({ testId: 'kft', checks: ['within-reference'] }),
    ).rejects.toMatchObject({ code: 'validation-failed' })

    const db = getDb()
    const item = Object.values(db.items).find(
      (i) => i.testId === 'lipid' && i.status === 'validated',
    )!
    const ctx = { now: Date.now(), by: STAFF.biochemistry }
    applyAutoCheck(db, item, ctx)
    const result = Object.values(db.results).find(
      (r) => r.orderItemId === item.id,
    )!
    expect(result.autoCheck).toBeUndefined()
    db.settings.autoVerifyEnabled = true
    applyAutoCheck(db, item, ctx)
    expect(result.autoCheck?.version).toBe(1)
    expect(typeof result.autoCheck?.passed).toBe('boolean')
  })

  it('prints Form III with its 14 columns and refuses a malformed month', async () => {
    const month = new Date(Date.now() + 5.5 * HOUR).toISOString().slice(0, 7)
    const form = await labApi.registers.formIII(month, { pageSize: 50 })
    expect(form.rows.length).toBeGreaterThan(0)
    const row = form.rows[0]!
    for (const key of [
      'serialNo',
      'date',
      'labNo',
      'patientName',
      'age',
      'sex',
      'address',
      'referredBy',
      'provisionalDiagnosis',
      'investigation',
      'specimen',
      'methodEquipment',
      'result',
      'initials',
    ])
      expect(row).toHaveProperty(key)
    await expect(labApi.registers.formIII('2026-13')).rejects.toMatchObject({
      code: 'validation-failed',
    })
  })

  it('validates modules, size tiers and the lab profile', async () => {
    await manager.system.updateSettings({
      sizeTier: 'small',
      modules: modulesForTier('small'),
    })
    expect(getDb().settings.modules.imaging).toBe(false)
    await expect(
      manager.system.updateSettings({
        profile: {
          ...getDb().settings.profile,
          registrationValidTo: 0,
        },
      }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    const sites = await labApi.sites.list()
    expect(sites[0]!.kind).toBe('main')
    await expect(
      manager.sites.save({
        code: 'X2',
        name: 'Second main',
        kind: 'main',
        city: 'Mysuru',
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
  })

  it('takes insight feedback, needing a reason for "not useful"', async () => {
    const [first] = await labApi.insights.list()
    expect(first).toBeDefined()
    await expect(
      tech.insights.feedback(first!.key, 'not-useful'),
    ).rejects.toMatchObject({ code: 'reason-required' })
    await tech.insights.feedback(first!.key, 'not-useful', 'Already handled.')
    const after = await actingAs(STAFF.technician).insights.list()
    expect(after.some((i) => i.key === first!.key)).toBe(false)
  })

  it("refuses a doctor another doctor's report", async () => {
    const db = getDb()
    const other = Object.values(db.reports).find(
      (r) => db.orders[r.orderId]?.doctorId !== 'dr_asha',
    )!
    await expect(
      actingAs('st_dr_asha').reports.get(other.id),
    ).rejects.toMatchObject({ code: 'not-found' })
  })
})
