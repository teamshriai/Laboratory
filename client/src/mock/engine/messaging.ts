// Messages to patients and doctors: templates per event, channel and
// language, opt-outs per patient, and an outbox. No SMS, WhatsApp or email
// gateway is connected in this build, so every message is recorded as not
// sent and says why. A backend sends through DLT-registered SMS templates
// and the WhatsApp Business API and updates the delivery state.

import { randomToken } from '@/domain/sha256'
import {
  LANGUAGES,
  MESSAGE_CHANNELS,
  MESSAGE_EVENTS,
  type Language,
  type MessageChannel,
  type MessageEvent,
  type MessageTemplate,
  type OutboundMessage,
} from '@/domain/types'
import { MAX_FEED_ENTRIES, type LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

export type TemplateInput = Omit<MessageTemplate, 'id'> & { id?: string }

export function saveTemplate(db: LabDb, input: TemplateInput, ctx: EngineCtx) {
  requirePermission(db, ctx, 'messaging.manage')
  if (
    !MESSAGE_EVENTS.includes(input.event) ||
    !MESSAGE_CHANNELS.includes(input.channel) ||
    !LANGUAGES.includes(input.language)
  )
    throw new LabApiError('validation-failed', { field: 'template' })
  const body = input.body.trim()
  if (!body || body.length > 1000)
    throw new LabApiError('validation-failed', { field: 'body' })
  // SMS to Indian numbers needs a template registered on the DLT platform.
  if (input.channel === 'sms' && input.active && !input.dltTemplateId?.trim())
    throw new LabApiError('validation-failed', { field: 'dltTemplateId' })
  const template: MessageTemplate = {
    id: input.id ?? `tpl_${randomToken(6)}`,
    event: input.event,
    channel: input.channel,
    language: input.language,
    body,
    active: input.active,
    ...(input.dltTemplateId?.trim()
      ? { dltTemplateId: input.dltTemplateId.trim() }
      : {}),
  }
  const existed = Boolean(input.id && db.templates[input.id])
  db.templates[template.id] = template
  audit(
    db,
    ctx,
    'settings',
    template.id,
    existed ? 'template-updated' : 'template-added',
    {
      detail: {
        event: template.event,
        channel: template.channel,
        language: template.language,
      },
    },
  )
  return template
}

/** Fills {placeholders}; unknown ones stay visible so they are noticed. */
export function renderTemplate(body: string, params: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (all, key: string) => params[key] ?? all)
}

/** The active template for an event and channel, in the language if any. */
function templateFor(
  db: LabDb,
  event: MessageEvent,
  channel: MessageChannel,
  language: Language,
) {
  const active = Object.values(db.templates).filter(
    (t) => t.active && t.event === event && t.channel === channel,
  )
  return (
    active.find((t) => t.language === language) ??
    active.find((t) => t.language === 'en')
  )
}

export interface SendInput {
  event: MessageEvent
  channel: MessageChannel
  /** Phone number or email address. */
  to: string
  patientId?: string
  relatedId?: string
  params: Record<string, string>
}

/**
 * Records a message for sending. Respects the patient's opt-out; without a
 * gateway it is kept as not sent, with the reason, and never claimed sent.
 */
export function sendMessage(db: LabDb, input: SendInput, ctx: EngineCtx) {
  const patient = input.patientId ? db.patients[input.patientId] : undefined
  const language = patient?.preferredLanguage ?? db.settings.defaultLanguage
  const template = templateFor(db, input.event, input.channel, language)
  const optedOut = Boolean(patient?.messagingOptOut?.[input.channel])
  const message: OutboundMessage = {
    id: `msg_${randomToken(9)}`,
    event: input.event,
    channel: input.channel,
    language: template?.language ?? language,
    to: input.to.trim(),
    ...(patient ? { patientId: patient.id } : {}),
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
    text: template ? renderTemplate(template.body, input.params) : '',
    state: 'not-sent',
    reason: optedOut ? 'opted-out' : template ? 'no-gateway' : 'no-template',
    at: ctx.now,
    by: ctx.by,
  }
  db.outbox.unshift(message)
  if (db.outbox.length > MAX_FEED_ENTRIES) db.outbox.length = MAX_FEED_ENTRIES
  return message
}

export function setMessagingOptOut(
  db: LabDb,
  patientId: string,
  channel: MessageChannel,
  optOut: boolean,
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'patient.edit')
  const patient = must(db.patients, patientId, 'patient')
  if (!MESSAGE_CHANNELS.includes(channel))
    throw new LabApiError('validation-failed', { field: 'channel' })
  patient.messagingOptOut = { ...patient.messagingOptOut, [channel]: optOut }
  audit(
    db,
    ctx,
    'patient',
    patient.id,
    optOut ? 'messaging-opted-out' : 'messaging-opted-in',
    {
      detail: { channel },
    },
  )
  return patient
}
