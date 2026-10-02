import { PenLineIcon, ShieldAlertIcon } from 'lucide-react'
import { usePreferences } from '@/app/preferences/context'
import type { Permission } from '@/domain/permissions'
import { hasPermission } from '@/domain/permissions'
import { usePermissions } from '@/hooks/use-permission'
import { useEnum, useT } from '@/i18n/context'
import { useReference } from '@/services/queries'
import { Select } from '@/components/ui/select'

/**
 * Who signs this action: always the person the app is acting as. When they
 * may not, it says why and offers to switch the acting user, the stand-in
 * for logging in as someone else. Nobody signs in another person's name.
 */
export function SigningAs({
  permission,
  compact,
}: {
  permission: Permission
  compact?: boolean
}) {
  const t = useT('common')
  const e = useEnum()
  const { actor, can, why } = usePermissions()
  const { setActorId } = usePreferences()
  const { data: reference } = useReference()
  if (!actor) return null
  if (can(permission))
    return (
      <p className="flex items-center gap-2 text-meta text-fg-muted">
        <PenLineIcon className="size-4 shrink-0 text-accent-text" aria-hidden />
        <span>
          {t('signingAs', {
            name: actor.name,
            role: e('staffRole', actor.role),
          })}
        </span>
      </p>
    )
  const eligible = (reference?.staff ?? []).filter((s) =>
    hasPermission(s, permission),
  )
  return (
    <div
      className={
        compact
          ? 'grid gap-2'
          : 'grid gap-2 rounded-lg bg-warning-soft p-3 text-warning-text'
      }
    >
      <p className="flex items-start gap-2 text-meta">
        <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{why(permission)}</span>
      </p>
      <Select
        size="sm"
        aria-label={t('switchActingAs')}
        placeholder={t('switchActingAs')}
        value={undefined}
        onValueChange={setActorId}
        options={eligible.map((s) => ({
          value: s.id,
          label: s.name,
          description: e('staffRole', s.role),
        }))}
      />
    </div>
  )
}
