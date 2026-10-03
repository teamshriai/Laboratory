// Today's Work, the Lab Assistant, share links and the report portal,
// imaging and the patient report history: all read the same state the
// worklists show.

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY, istDay } from '@/domain/time'
import { getDb, startMemoryDb } from '../db/store'
import { labApi } from './index'
import { actingAs, STAFF } from './testing'

const tech = actingAs(STAFF.technician)
const pathologist = actingAs(STAFF.pathologist)

describe("today's work and the assistant", () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('counts exactly what the queues it links to list', async () => {
    const today = await labApi.today.get()
    const count = (key: string) => today.todo.find((t) => t.key === key)!.count
    const stages = await labApi.validation.stageCounts({})
    expect(count('verify')).toBe(stages.review)
    expect(count('authorise')).toBe(stages.authorise)
    const criticals = await labApi.critical.list({ status: 'pending', q: '' })
    expect(count('critical')).toBe(criticals.counts.pending)
    const queue = await labApi.workQueue.list({ bucket: 'all', q: '' })
    expect(count('recollection')).toBe(queue.counts.recollection)
    expect(count('reception')).toBe(queue.counts.collected)
    const ready = await labApi.reports.list({
      status: 'validated',
      date: 'all',
      q: '',
    })
    expect(count('release')).toBe(ready.counts.validated)
    // The most urgent work leads the priority list.
    expect(today.priorities[0]?.key).toBe('critical')
    expect(today.agenda.length).toBeGreaterThan(0)
    expect(today.summary.ordersToday).toBeGreaterThan(0)
  })

  it('answers from the current state, and follows it when it changes', async () => {
    const before = await labApi.assistant.ask({ intent: 'critical' })
    const pending = await labApi.critical.list({ status: 'pending', q: '' })
    expect(before.lines[0]).toEqual({
      key: 'critical',
      params: { count: pending.counts.pending },
    })
    expect(before.links[0]?.to).toBe('/critical-results?status=pending')

    // Communicate every pending critical: the answer becomes "none".
    for (const row of pending.rows)
      await tech.critical.document(row.id, {
        notifiedTo: 'Dr. Asha Kiran',
        role: 'consultant',
        method: 'phone',
        notifiedAt: Date.now(),
        acknowledged: true,
        readBack: true,
      })
    const after = await labApi.assistant.ask({ text: 'Any critical results?' })
    expect(after.intent).toBe('critical')
    expect(after.lines).toEqual([{ key: 'criticalNone' }])
  })

  it('understands typed questions and falls back to help', async () => {
    const cases: [string, string][] = [
      ['What needs my attention?', 'attention'],
      ["Show today's pending tests", 'pending'],
      ['Which specimens are awaiting reception?', 'reception'],
      ['What reports are awaiting authorization?', 'authorise'],
      ['Show STAT tests', 'stat'],
      ['How many tests were completed today?', 'completed'],
      ['Show rejected specimens', 'rejected'],
      ['Show delayed reports', 'delayed'],
      ['What needs verification?', 'verify'],
      ['Any MRI waiting?', 'imaging'],
      ['Tell me a joke', 'help'],
    ]
    for (const [text, intent] of cases)
      expect((await labApi.assistant.ask({ text })).intent, text).toBe(intent)
  })
})

describe('share links and the report portal', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('shares only released reports, and the portal needs the link', async () => {
    const reports = await labApi.reports.list({ date: 'all', q: '' })
    const released = reports.rows.find((r) => r.status === 'released')!
    const unreleased = reports.rows.find((r) => r.status === 'validated')!

    await expect(labApi.portal.report(released.reportNo)).rejects.toMatchObject(
      { code: 'not-found' },
    )
    await expect(tech.reports.shareLink(unreleased.id)).rejects.toMatchObject({
      code: 'report-not-released',
    })
    // Receptionists may share; phlebotomists may not.
    await expect(
      actingAs(STAFF.phlebotomist).reports.shareLink(released.id),
    ).rejects.toMatchObject({ code: 'not-permitted' })

    const link = await actingAs(STAFF.reception).reports.shareLink(released.id)
    expect(link.reportNo).toBe(released.reportNo)
    const view = await labApi.portal.report(released.reportNo)
    expect(view.kind).toBe('laboratory')
    if (view.kind === 'laboratory') {
      expect(view.report.reportNo).toBe(released.reportNo)
      expect('shareLog' in view.report).toBe(false)
    }
    expect(
      getDb().audit.some(
        (a) => a.action === 'link-created' && a.entityId === released.id,
      ),
    ).toBe(true)
  })

  it('stops showing a withdrawn report even with a link', async () => {
    const reports = await labApi.reports.list({ date: 'all', q: '' })
    const released = reports.rows.find((r) => r.status === 'released')!
    await tech.reports.shareLink(released.id)
    await pathologist.reports.withdraw(
      released.id,
      'Issued for the wrong visit',
    )
    await expect(labApi.portal.report(released.reportNo)).rejects.toMatchObject(
      { code: 'not-found' },
    )
  })

  it('shows an earlier version as it was issued', async () => {
    const reports = await labApi.reports.list({ date: 'all', q: '' })
    const amended = reports.rows.find((r) => r.status === 'corrected')!
    const current = await labApi.reports.get(amended.id)
    const first = await labApi.reports.get(amended.id, { version: 1 })
    expect(current.supersededBy).toBeUndefined()
    expect(first.supersededBy).toBe(current.version)
    expect(first.version).toBe(1)
    const changed = current.sections
      .flatMap((s) => s.rows)
      .find((r) => r.previousVersions.length > 0)!
    const then = first.sections
      .flatMap((s) => s.rows)
      .find((r) => r.resultId === changed.resultId)!
    expect(then.value).toBe(changed.previousVersions.at(-1)!.value)
    expect(then.value).not.toBe(changed.value)
  })
})

describe('diagnostic imaging and the patient report history', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  it('has two reported studies per modality and work still to do', async () => {
    for (const modality of ['ct', 'mri', 'xray'] as const) {
      const rows = await labApi.imaging.list({ modality })
      expect(rows.filter((r) => r.version > 0).length).toBe(2)
    }
    const overview = await labApi.imaging.overview()
    expect(overview.counts.awaitingReport).toBeGreaterThan(0)
    expect(overview.counts.scheduled).toBeGreaterThan(0)
    expect(overview.counts.amended).toBe(1)
  })

  it('keeps the earlier version of an amended imaging report', async () => {
    const mri = await labApi.imaging.list({
      modality: 'mri',
      status: 'amended',
    })
    const study = mri[0]!
    const current = await labApi.imaging.report(study.id)
    const first = await labApi.imaging.report(study.id, { version: 1 })
    expect(current.viewing?.kind).toBe('amended')
    expect(current.viewing?.amendmentReason).toBeTruthy()
    expect(first.viewing?.kind).toBe('final')
    expect(first.supersededBy).toBe(2)
    expect(first.status).toBe('final')
  })

  it('lists laboratory and imaging reports together for a patient', async () => {
    const studies = await labApi.imaging.list({})
    const reported = studies.find((s) => s.version > 0)!
    const patient = await labApi.patients.get(reported.patient.id)
    const kinds = new Set(patient.reportHistory.map((r) => r.kind))
    expect(kinds.has('imaging')).toBe(true)
    const entry = patient.reportHistory.find((r) => r.id === reported.id)!
    expect(entry.href).toBe(`/imaging/reports/${reported.id}`)
    const dates = patient.reportHistory.map((r) => r.date)
    expect(dates).toEqual(dates.toSorted((a, b) => b - a))
  })

  it('shares an issued imaging report through the same portal', async () => {
    const [study] = (await labApi.imaging.list({ modality: 'ct' })).filter(
      (s) => s.version > 0,
    )
    await tech.imaging.shareLink(study!.id)
    const view = await labApi.portal.report(study!.reportNo!)
    expect(view.kind).toBe('imaging')
    const waiting = (await labApi.imaging.list({ status: 'acquired' }))[0]!
    await expect(tech.imaging.shareLink(waiting.id)).rejects.toMatchObject({
      code: 'report-not-released',
    })
  })
})

describe('the dashboard calendar', () => {
  beforeEach(() => {
    startMemoryDb()
  })

  const day = (offset: number) => istDay(Date.now() + offset * DAY)

  it('shows the recorded history, today live, and scheduled imaging', async () => {
    const db = getDb()
    const { days, average } = await labApi.today.calendar({
      from: day(-40),
      to: day(7),
    })
    expect(days).toHaveLength(48)
    expect(average).toBeGreaterThan(0)

    // Past days carry exactly the recorded figures.
    const yesterday = days.find((d) => d.day === day(-1))!
    const recorded = db.dailyStats.find((d) => d.day === day(-1))!
    expect(yesterday).toMatchObject({
      state: 'past',
      hasData: true,
      samples: recorded.samples,
      completed: recorded.completed,
      criticals: recorded.criticals,
    })
    expect(yesterday.busy).toBeDefined()

    // Today matches the dashboard's own live figures.
    const today = days.find((d) => d.state === 'today')!
    const overview = await labApi.analytics.report({ preset: 'today' })
    expect(today.day).toBe(day(0))
    expect(today.samples).toBe(overview.totals.samples)

    // Beyond the history there are no records; the future has none yet.
    expect(days[0]).toMatchObject({ state: 'past', hasData: false, samples: 0 })
    expect(days.at(-1)).toMatchObject({ state: 'future', hasData: false })
    expect(days.at(-1)?.busy).toBeUndefined()

    // Every imaging study is counted on its scheduled day.
    const scheduled = Object.values(db.imaging).filter(
      (s) =>
        istDay(s.scheduledAt) >= day(-40) && istDay(s.scheduledAt) <= day(7),
    ).length
    expect(days.reduce((n, d) => n + d.imaging, 0)).toBe(scheduled)
  })

  it('refuses malformed or oversized ranges', async () => {
    await expect(
      labApi.today.calendar({ from: 'yesterday', to: day(0) }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    await expect(
      labApi.today.calendar({ from: day(0), to: day(-1) }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
    await expect(
      labApi.today.calendar({ from: day(-100), to: day(0) }),
    ).rejects.toMatchObject({ code: 'validation-failed' })
  })
})
