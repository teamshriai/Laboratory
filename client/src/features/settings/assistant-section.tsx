import { ArrowRightIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { LabSettings } from '@/domain/types'
import { useT } from '@/i18n/context'
import { useLabSettings } from '@/services/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Switch } from '@/components/ui/toggles'
import { ReadOnlyNote, SaveBar, SettingRow } from './section-parts'
import { useReportDirty } from './settings-dirty'
import { useCanEditSettings, useSaveSettings } from './settings-forms'

type State = Pick<LabSettings, 'assistantEnabled' | 'autoVerifyEnabled'>

function AssistantForm({ initial }: { initial: State }) {
  const t = useT('settings')
  const canEdit = useCanEditSettings()
  const [v, setV] = useState<State>(initial)
  const dirty =
    v.assistantEnabled !== initial.assistantEnabled ||
    v.autoVerifyEnabled !== initial.autoVerifyEnabled
  useReportDirty('assistant', dirty)
  const save = useSaveSettings(() => t('assistantSaved'))
  return (
    <div>
      <ReadOnlyNote />
      <SettingRow
        title={t('assistantEnabled')}
        hint={t('assistantEnabledHint')}
        control={
          <Switch
            checked={v.assistantEnabled}
            onCheckedChange={(on) =>
              setV((p) => ({ ...p, assistantEnabled: on }))
            }
            label={t('assistantEnabled')}
            disabled={!canEdit}
          />
        }
      />
      <SettingRow
        title={t('autoVerifyEnabled')}
        hint={t('autoVerifyEnabledHint')}
        control={
          <Switch
            checked={v.autoVerifyEnabled}
            onCheckedChange={(on) =>
              setV((p) => ({ ...p, autoVerifyEnabled: on }))
            }
            label={t('autoVerifyEnabled')}
            disabled={!canEdit}
          />
        }
      >
        <p
          className="mt-2 flex items-start gap-1.5 text-xs text-fg-muted"
          role="status"
        >
          <ShieldCheckIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          {v.autoVerifyEnabled ? t('autoVerifyOn') : t('autoVerifyOff')}
        </p>
        <Link
          to="/quality?tab=autoverify"
          className="focus-ring mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-meta font-medium text-accent-text underline-offset-2 hover:underline"
        >
          {t('autoVerifyRules')}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </SettingRow>
      <SaveBar
        label={t('saveAssistant')}
        dirty={dirty}
        loading={save.isPending}
        onSave={() => save.mutate(v)}
      />
    </div>
  )
}

/** The rule-based Lab Assistant and the auto-verification kill switch. */
export function AssistantSection() {
  const settings = useLabSettings()
  if (settings.isError && !settings.data)
    return <ErrorState compact onRetry={() => void settings.refetch()} />
  if (!settings.data) return <Skeleton className="h-48 rounded-lg" />
  const { assistantEnabled, autoVerifyEnabled } = settings.data
  return (
    <AssistantForm
      key={`${assistantEnabled}-${autoVerifyEnabled}`}
      initial={{ assistantEnabled, autoVerifyEnabled }}
    />
  )
}
