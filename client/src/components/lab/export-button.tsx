import { DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { istDay } from '@/domain/time'
import type { AuditEntity } from '@/domain/types'
import { useLanguage, useT } from '@/i18n/context'
import { downloadCsv, type CsvCell } from '@/lib/csv'
import { labApi } from '@/services/lab-api'
import { errorMessage } from '@/services/mutations'
import { GuardedButton } from './guarded-button'

/**
 * Downloads every row matching the list's current filters (not just the
 * page on screen) as CSV, and records the export in the audit log.
 * Exporting is a manager's right; others see why the button is disabled.
 */
export function ExportButton({
  filename,
  entity,
  rows,
  disabled,
}: {
  filename: string
  /** What the list holds, for the audit entry. */
  entity: AuditEntity
  /** Header row first; built (and fetched) only when clicked. */
  rows: () => CsvCell[][] | Promise<CsvCell[][]>
  disabled?: boolean
}) {
  const t = useT('common')
  const te = useT('errors')
  const { language } = useLanguage()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const table = await rows()
      // Recorded first: an export that cannot be audited does not happen.
      await labApi.admin.recordAccess({
        kind: 'exported',
        entity,
        id: filename,
        count: Math.max(0, table.length - 1),
      })
      downloadCsv(`${filename}-${istDay(Date.now())}`, table)
    } catch (error) {
      toast.error(te('genericTitle'), {
        description: errorMessage(error, language),
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <GuardedButton
      permission="data.export"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={() => void run()}
    >
      <DownloadIcon />
      {t('exportCsv')}
    </GuardedButton>
  )
}
