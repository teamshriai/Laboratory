import { useEffect } from 'react'
import type { AuditEntity } from '@/domain/types'
import { labApi } from '@/services/lab-api'

/**
 * Notes in the audit log that the acting user opened a record with personal
 * health information (a backend logs this as it serves the record). Repeat
 * views within half an hour are noted once.
 */
export function useRecordView(entity: AuditEntity, id: string | undefined) {
  useEffect(() => {
    if (!id) return
    // Best effort: failing to note a view must not break the page.
    labApi.admin
      .recordAccess({ kind: 'viewed', entity, id })
      .catch(() => undefined)
  }, [entity, id])
}
