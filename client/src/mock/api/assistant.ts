// The Lab Assistant's mock brain: plain rules over the same Today's Work
// read model the dashboard shows. No AI and no network. A future AI or
// backend service implements the same `ask` contract (services/assistant.ts).

import { startOfIstDay } from '@/domain/time'
import { isItemLive } from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import type { DbIndex } from './index-cache'
import { imagingRows } from './imaging'
import { write } from './runtime'
import { getIndex } from './index-cache'
import { audit, LabApiError } from '../engine/core'
import { todayView } from './today'
import type {
  AssistantIntent,
  AssistantLine,
  AssistantReply,
  TodayView,
  WorkQueueRow,
} from './types'
import { ASSISTANT_INTENTS } from './types'
import { workQueueList } from './work-queue'

/** Keyword rules, most specific first. */
const RULES: [AssistantIntent, RegExp][] = [
  ['critical', /critical|panic|alert value/i],
  ['stat', /\bstat\b|emergency/i],
  ['reception', /recept|receiv|transit|arriv/i],
  ['authorise', /authori[sz]|sign[- ]?off|pathologist/i],
  ['verify', /verif|review|check results/i],
  ['rejected', /reject|recollect|redraw/i],
  ['delayed', /delay|late|overdue|tat|turnaround|slow/i],
  ['completed', /complet|done|finish|released|how many.*today/i],
  ['imaging', /imaging|radiolog|\bct\b|\bmri\b|x-?ray/i],
  ['pending', /pending|outstanding|remaining|left|to do|todo/i],
  ['attention', /attention|priorit|urgent|next|focus|what should|need.*me/i],
]

export function matchIntent(text: string): AssistantIntent {
  const clean = text.trim()
  if (!clean) return 'help'
  return RULES.find(([, re]) => re.test(clean))?.[0] ?? 'help'
}

const line = (
  key: string,
  params?: Record<string, string | number>,
): AssistantLine => (params ? { key, params } : { key })
const data = (text: string): AssistantLine => ({ text })

/** "LAB-..-0042 · CBC, CRP · Anitha R" (recorded data, not copy). */
const rowText = (r: WorkQueueRow) =>
  `${r.accessionNo ?? ''} · ${r.tests.map((t) => t.shortName).join(', ')} · ${r.patient.name}`

function answer(
  intent: AssistantIntent,
  db: LabDb,
  index: DbIndex,
  now: number,
  view: TodayView,
): AssistantReply {
  const todo = (key: TodayView['todo'][number]['key']) =>
    view.todo.find((t) => t.key === key)!
  const priority = (key: TodayView['priorities'][number]['key']) =>
    view.priorities.find((p) => p.key === key)
  const queue = () => workQueueList(db, index, now, { bucket: 'all', q: '' })
  const age = (at: number | undefined) => (at === undefined ? 0 : now - at)
  const reply = (
    lines: AssistantLine[],
    links: AssistantReply['links'] = [],
    bullets: AssistantLine[] = [],
  ): AssistantReply => ({ intent, lines, bullets, links })

  switch (intent) {
    case 'attention': {
      const items = view.priorities
      if (items.length === 0)
        return reply(
          [line('attentionNone')],
          [{ key: 'linkDashboard', to: '/dashboard' }],
        )
      const total = items.reduce((n, p) => n + p.count, 0)
      return reply(
        [line('attention', { count: total })],
        [{ key: 'linkPriority', to: items[0]!.to }],
        items.map((p) => line(`priority.${p.key}`, { count: p.count })),
      )
    }
    case 'critical': {
      const c = todo('critical')
      const p = priority('critical')
      if (c.count === 0) return reply([line('criticalNone')])
      return reply(
        [
          line('critical', { count: c.count }),
          ...(p?.overdue
            ? [line('criticalOverdue', { count: p.overdue })]
            : []),
        ],
        [{ key: 'linkCritical', to: c.to }],
        Object.values(db.criticals)
          .filter((x) => x.status === 'open' || x.status === 'notified')
          .toSorted((a, b) => a.detectedAt - b.detectedAt)
          .slice(0, 5)
          .map((x) =>
            data(
              `${db.analytes[x.analyteId]?.name ?? x.analyteId} ${x.value} · ${db.patients[x.patientId]?.name ?? ''}`,
            ),
          ),
      )
    }
    case 'reception': {
      const r = todo('reception')
      if (r.count === 0) return reply([line('receptionNone')])
      const rows = queue()
        .rows.filter((x) => x.buckets.includes('collected'))
        .toSorted((a, b) => (a.collectedAt ?? 0) - (b.collectedAt ?? 0))
      return reply(
        [
          line('reception', { count: r.count }),
          line('oldest', { ms: age(r.oldestAt) }),
        ],
        [{ key: 'linkReception', to: r.to }],
        rows.slice(0, 5).map((x) => data(rowText(x))),
      )
    }
    case 'verify': {
      const v = todo('verify')
      if (v.count === 0) return reply([line('verifyNone')])
      return reply(
        [
          line('verify', { count: v.count }),
          ...(v.dueToday ? [line('dueToday', { count: v.dueToday })] : []),
        ],
        [{ key: 'linkVerify', to: v.to }],
      )
    }
    case 'authorise': {
      const a = todo('authorise')
      const ready = todo('release')
      if (a.count === 0 && ready.count === 0)
        return reply([line('authoriseNone')])
      return reply(
        [
          line('authorise', { count: a.count }),
          ...(a.oldestAt ? [line('oldest', { ms: age(a.oldestAt) })] : []),
          ...(ready.count
            ? [line('readyRelease', { count: ready.count })]
            : []),
        ],
        [
          { key: 'linkAuthorise', to: a.to },
          ...(ready.count ? [{ key: 'linkRelease', to: ready.to }] : []),
        ],
      )
    }
    case 'stat': {
      const rows = queue().rows.filter((x) => x.buckets.includes('stat'))
      if (rows.length === 0) return reply([line('statNone')])
      const oldest = Math.min(
        ...rows.map((x) => x.receivedAt ?? x.collectedAt ?? x.createdAt),
      )
      return reply(
        [
          line('stat', { count: rows.length }),
          line('oldest', { ms: now - oldest }),
        ],
        [{ key: 'linkStat', to: '/work-queue?bucket=stat' }],
        rows.slice(0, 5).map((x) => data(rowText(x))),
      )
    }
    case 'pending': {
      const e = todo('entry')
      const c = todo('collection')
      const r = todo('reception')
      return reply(
        [
          line('pending', {
            count: e.count + c.count + r.count,
          }),
          line('pendingDue', { count: e.dueToday + r.dueToday }),
        ],
        [
          { key: 'linkWorklists', to: e.to },
          { key: 'linkWorkQueue', to: '/work-queue' },
        ],
        [
          line('pendingEntry', { count: e.count }),
          line('pendingReception', { count: r.count }),
          line('pendingCollection', { count: c.count }),
        ],
      )
    }
    case 'completed': {
      const start = startOfIstDay(now)
      const authorised = Object.values(db.items).filter(
        (i) => isItemLive(i) && (i.validatedAt ?? 0) >= start,
      ).length
      return reply(
        [line('completed', { count: authorised })],
        [{ key: 'linkReports', to: '/reports?status=released' }],
        [
          line('summaryVerified', { count: view.summary.verified }),
          line('summaryReleased', { count: view.summary.released }),
          line('summaryReceived', { count: view.summary.received }),
        ],
      )
    }
    case 'rejected': {
      const start = startOfIstDay(now)
      const rejected = Object.values(db.samples).filter(
        (s) => (s.rejection?.at ?? 0) >= start,
      )
      const recollect = todo('recollection')
      if (rejected.length === 0 && recollect.count === 0)
        return reply([line('rejectedNone')])
      return reply(
        [
          line('rejected', { count: rejected.length }),
          line('recollection', { count: recollect.count }),
        ],
        [
          { key: 'linkRecollection', to: recollect.to },
          { key: 'linkRejected', to: '/work-queue?bucket=rejected' },
        ],
        rejected
          .slice(0, 5)
          .map((s) =>
            data(
              `${s.accessionNo ?? ''} · ${db.patients[s.patientId]?.name ?? ''}`,
            ),
          ),
      )
    }
    case 'delayed': {
      const rows = queue().rows.filter((x) => x.buckets.includes('overdue'))
      const transit = priority('transit')?.count ?? 0
      if (rows.length === 0 && transit === 0)
        return reply([line('delayedNone')])
      return reply(
        [
          line('delayed', { count: rows.length }),
          ...(transit ? [line('delayedTransit', { count: transit })] : []),
        ],
        [{ key: 'linkDelayed', to: '/work-queue?bucket=overdue' }],
        rows
          .toSorted((a, b) => (b.tat?.ratio ?? 0) - (a.tat?.ratio ?? 0))
          .slice(0, 5)
          .map((x) => data(rowText(x))),
      )
    }
    case 'imaging': {
      const rows = imagingRows(db)
      const waiting = rows.filter((r) => r.status === 'acquired')
      const scheduled = rows.filter((r) => r.status === 'scheduled').length
      return reply(
        [
          line('imaging', { count: waiting.length }),
          line('imagingScheduled', { count: scheduled }),
        ],
        [{ key: 'linkImaging', to: '/imaging' }],
        waiting
          .slice(0, 5)
          .map((r) => data(`${r.examName} · ${r.patient.name}`)),
      )
    }
    case 'help':
      return reply([line('help')])
  }
}

/** Version of the rule set the answers come from (shown with each answer). */
const ASSISTANT_RULES = 'assistant-rules 1.0'

export const assistantApi = {
  /** The questions offered as one-tap suggestions. */
  suggestions: () => [...ASSISTANT_INTENTS].filter((i) => i !== 'help'),

  /**
   * Answers from the same read model as the dashboard. Each question is
   * audited (its intent, never the typed text); the lab can switch the
   * assistant off in Settings.
   */
  ask: (question: { intent?: AssistantIntent; text?: string }) =>
    write((db, ctx): AssistantReply => {
      if (!db.settings.assistantEnabled) throw new LabApiError('assistant-off')
      const intent = question.intent ?? matchIntent(question.text ?? '')
      audit(db, ctx, 'system', 'assistant', 'assistant-asked', {
        detail: { intent, rules: ASSISTANT_RULES },
      })
      const index = getIndex(db)
      return {
        ...answer(intent, db, index, ctx.now, todayView(db, index, ctx.now)),
        source: { readModel: 'today', at: ctx.now, rules: ASSISTANT_RULES },
      }
    }),
}
