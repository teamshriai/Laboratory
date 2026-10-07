import { LockIcon } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { usePermissions } from '@/hooks/use-permission'
import { useT } from '@/i18n/context'
import { GuardedButton } from '@/components/lab/guarded-button'
import { UnsavedChangesDialog } from '@/components/ui/unsaved-dialog'
import type { DirtyStore } from './settings-dirty'

/** A setting with its explanation on the left and the control on the right. */
export function SettingRow({
  title,
  hint,
  control,
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  control: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="border-b border-line py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-sm font-medium text-fg">{title}</p>
          {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
      {children}
    </div>
  )
}

/** Says why the controls are read-only for the acting user. */
export function ReadOnlyNote() {
  const t = useT('settings')
  const { can, why } = usePermissions()
  if (can('settings.edit')) return null
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-meta text-fg-muted">
      <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="block font-medium text-fg">{t('readOnly')}</span>
        {why('settings.edit')}
      </span>
    </p>
  )
}

/** The section's save button, with a note while there are changes. */
export function SaveBar({
  label,
  dirty,
  loading,
  onSave,
  children,
}: {
  label: string
  dirty: boolean
  loading: boolean
  onSave: () => void
  children?: ReactNode
}) {
  const t = useT('settings')
  return (
    <div className="mt-5 grid gap-3 border-t border-line pt-4">
      {children}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {dirty ? (
          <p className="text-meta text-fg-muted" role="status">
            {t('unsavedChanges')}
          </p>
        ) : null}
        <GuardedButton
          permission="settings.edit"
          variant="primary"
          loading={loading}
          disabled={!dirty}
          onClick={onSave}
        >
          {label}
        </GuardedButton>
      </div>
    </div>
  )
}

/** Asks before leaving the page while any section has unsaved changes. */
export function UnsavedSettingsGuard({ store }: { store: DirtyStore }) {
  const dirty = useSyncExternalStore(store.subscribe, store.get, store.get)
  const blocker = useUnsavedChanges(dirty)
  return <UnsavedChangesDialog blocker={blocker} />
}
