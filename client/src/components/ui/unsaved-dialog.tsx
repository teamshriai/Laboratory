import type { Blocker } from 'react-router'
import { useT } from '@/i18n/context'
import { ConfirmDialog } from './confirm-dialog'

/** "Leave without saving?" for a blocker from `useUnsavedChanges`. */
export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  const t = useT('common')
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(o) => !o && blocker.reset?.()}
      title={t('unsavedTitle')}
      description={t('unsavedBody')}
      confirmLabel={t('unsavedLeave')}
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
