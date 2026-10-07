// Analyser interfaces (simulated: no analyser is connected in this build)
// and the lab's sites. Test-code mappings are versioned; a message that
// failed for an unmapped code succeeds on retry once the code is mapped.

import { randomToken } from '@/domain/sha256'
import { SITE_KINDS, type CodeMapping, type Site } from '@/domain/types'
import type { LabDb } from '../db/schema'
import {
  audit,
  LabApiError,
  must,
  requirePermission,
  type EngineCtx,
} from './core'

const id = (prefix: string) =>
  `${prefix}_${randomToken(6)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`

export function mappingFor(
  db: LabDb,
  equipmentId: string,
  instrumentCode: string,
) {
  return Object.values(db.codeMappings)
    .filter(
      (m) =>
        m.equipmentId === equipmentId && m.instrumentCode === instrumentCode,
    )
    .toSorted((a, b) => b.version - a.version)[0]
}

/** Maps an instrument code to an analyte (a new version each change). */
export function saveCodeMapping(
  db: LabDb,
  input: { equipmentId: string; instrumentCode: string; analyteId: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'interface.manage')
  const eq = must(db.equipment, input.equipmentId, 'equipment')
  must(db.analytes, input.analyteId, 'analyte')
  const code = input.instrumentCode.trim().toUpperCase()
  if (!/^[A-Z0-9_.^-]{1,20}$/.test(code))
    throw new LabApiError('validation-failed', { field: 'instrumentCode' })
  const previous = mappingFor(db, eq.id, code)
  if (previous?.analyteId === input.analyteId) return previous
  const mapping: CodeMapping = {
    id: id('map'),
    equipmentId: eq.id,
    instrumentCode: code,
    analyteId: input.analyteId,
    version: (previous?.version ?? 0) + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.by,
  }
  db.codeMappings[mapping.id] = mapping
  audit(db, ctx, 'interface', eq.id, 'code-mapped', {
    ...(previous
      ? {
          from: db.analytes[previous.analyteId]?.name ?? previous.analyteId,
        }
      : {}),
    to: db.analytes[input.analyteId]?.name ?? input.analyteId,
    detail: { code, version: mapping.version },
  })
  return mapping
}

/**
 * Retries a failed message. An unmapped code goes through once it is
 * mapped and an unknown accession once the specimen exists; other errors
 * (checksum, timeout) need the analyser to resend, so they stay failed.
 */
export function retryMessage(db: LabDb, messageId: string, ctx: EngineCtx) {
  requirePermission(db, ctx, 'interface.manage')
  const message = db.interfaceLog.find((m) => m.id === messageId)
  if (!message)
    throw new LabApiError('not-found', { entity: 'message', id: messageId })
  if (message.state !== 'error') throw new LabApiError('invalid-transition', {})
  message.retries += 1
  const fixed =
    (message.error === 'unmapped-code' &&
      message.instrumentCode !== undefined &&
      Boolean(mappingFor(db, message.equipmentId, message.instrumentCode))) ||
    (message.error === 'unknown-accession' &&
      Object.values(db.samples).some(
        (s) => s.accessionNo === message.accessionNo,
      ))
  if (fixed) {
    message.state = 'processed'
    delete message.error
  }
  audit(db, ctx, 'interface', message.equipmentId, 'message-retried', {
    to: message.state,
    detail: { message: message.id, retries: message.retries },
  })
  return message
}

export function saveSite(
  db: LabDb,
  input: Omit<Site, 'id'> & { id?: string },
  ctx: EngineCtx,
) {
  requirePermission(db, ctx, 'settings.edit')
  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  if (!/^[A-Z0-9-]{2,10}$/.test(code))
    throw new LabApiError('validation-failed', { field: 'code' })
  if (!name) throw new LabApiError('validation-failed', { field: 'name' })
  if (!SITE_KINDS.includes(input.kind))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (Object.values(db.sites).some((s) => s.code === code && s.id !== input.id))
    throw new LabApiError('duplicate-code', { code })
  const existing = input.id ? must(db.sites, input.id, 'site') : undefined
  // There is always exactly one main laboratory, and it stays active.
  if (existing?.kind === 'main' && (input.kind !== 'main' || !input.active))
    throw new LabApiError('validation-failed', { field: 'kind' })
  if (
    !existing &&
    input.kind === 'main' &&
    Object.values(db.sites).some((s) => s.kind === 'main')
  )
    throw new LabApiError('validation-failed', { field: 'kind' })
  const site: Site = {
    id: existing?.id ?? id('site'),
    code,
    name,
    kind: input.kind,
    city: input.city.trim(),
    active: input.active,
  }
  db.sites[site.id] = site
  audit(
    db,
    ctx,
    'settings',
    site.id,
    existing ? 'site-updated' : 'site-added',
    {
      detail: { site: `${site.code} ${site.name}` },
    },
  )
  return site
}
