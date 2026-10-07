import { EyeIcon, EyeOffIcon, InfoIcon } from 'lucide-react'
import { useState } from 'react'
import { modulesForTier, TIER_MODULES } from '@/domain/modules'
import {
  MODULES,
  SIZE_TIERS,
  type LabSettings,
  type ModuleId,
  type SizeTier,
} from '@/domain/types'
import { useT } from '@/i18n/context'
import { useLabSettings } from '@/services/queries'
import {
  BUSINESS_NAV,
  DOCTOR_NAV,
  IMAGING_NAV,
  INVENTORY_NAV,
  LAB_NAV,
  OPERATIONS_NAV,
  QUALITY_NAV,
  ADMIN_NAV,
  type NavItem,
} from '@/app/layout/nav-config'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { ChoiceCards, Switch } from '@/components/ui/toggles'
import { ReadOnlyNote, SaveBar, SettingRow } from './section-parts'
import { useReportDirty } from './settings-dirty'
import { useCanEditSettings, useSaveSettings } from './settings-forms'

const NAV: NavItem[] = [
  ...LAB_NAV,
  ...INVENTORY_NAV,
  ...OPERATIONS_NAV,
  ...IMAGING_NAV,
  ...BUSINESS_NAV,
  ...QUALITY_NAV,
  ...DOCTOR_NAV,
  ...ADMIN_NAV,
]

type State = Pick<LabSettings, 'sizeTier' | 'modules'>

const sameModules = (a: State['modules'], b: State['modules']) =>
  MODULES.every((m) => a[m] === b[m])

function ModulesForm({ initial }: { initial: State }) {
  const t = useT('settings')
  const tn = useT('nav')
  const canEdit = useCanEditSettings()
  const [v, setV] = useState<State>(initial)
  const navOf = (m: ModuleId) =>
    NAV.filter((item) => item.module === m).map((item) => tn(item.key))
  const moduleName = (m: ModuleId) => t(`module.${m}`)
  const turnedOn = MODULES.filter((m) => v.modules[m] && !initial.modules[m])
  const turnedOff = MODULES.filter((m) => !v.modules[m] && initial.modules[m])
  const appear = turnedOn.flatMap(navOf)
  const disappear = turnedOff.flatMap(navOf)
  const dirty =
    v.sizeTier !== initial.sizeTier || turnedOn.length + turnedOff.length > 0
  useReportDirty('modules', dirty)
  const customised = !sameModules(v.modules, modulesForTier(v.sizeTier))
  const summary = [
    appear.length ? t('navAppear', { items: appear.join(', ') }) : '',
    disappear.length ? t('navDisappear', { items: disappear.join(', ') }) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const save = useSaveSettings(() =>
    summary
      ? { title: t('modulesSaved'), description: summary }
      : t('modulesSaved'),
  )

  return (
    <div>
      <ReadOnlyNote />
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-6">
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-fg">
            {t('sizeTier')}
          </legend>
          <p className="mt-0.5 mb-3 text-xs text-fg-muted">
            {t('sizeTierHint')}
          </p>
          <ChoiceCards<SizeTier>
            aria-label={t('sizeTier')}
            value={v.sizeTier}
            onValueChange={(tier) =>
              setV({ sizeTier: tier, modules: modulesForTier(tier) })
            }
            options={SIZE_TIERS.map((tier) => ({
              value: tier,
              label: t(`tier.${tier}`),
              description: (
                <>
                  {t(`tier.${tier}.hint`)}
                  <span className="mt-1 block text-fg-subtle">
                    {t('tierIncludes', {
                      modules: TIER_MODULES[tier].map(moduleName).join(', '),
                    })}
                  </span>
                </>
              ),
            }))}
          />
          {customised ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
              <InfoIcon className="size-3.5 shrink-0" aria-hidden />
              {t('tierCustomised')}
            </p>
          ) : null}
        </fieldset>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">
            {t('modulesTitle')}
          </h3>
          {MODULES.map((m) => (
            <SettingRow
              key={m}
              title={moduleName(m)}
              hint={t(`module.${m}.hint`)}
              control={
                <Switch
                  checked={v.modules[m]}
                  onCheckedChange={(on) =>
                    setV((p) => ({ ...p, modules: { ...p.modules, [m]: on } }))
                  }
                  label={moduleName(m)}
                  disabled={!canEdit}
                />
              }
            >
              <p className="mt-1 text-xs text-fg-subtle">
                {t('inNavigation', { items: navOf(m).join(', ') })}
              </p>
            </SettingRow>
          ))}
        </div>
      </fieldset>
      <SaveBar
        label={t('saveModules')}
        dirty={dirty}
        loading={save.isPending}
        onSave={() => save.mutate({ sizeTier: v.sizeTier, modules: v.modules })}
      >
        {appear.length || disappear.length ? (
          <div
            role="status"
            className="grid gap-1.5 rounded-lg border border-info-text/25 bg-info-soft px-3.5 py-2.5 text-meta text-info-text"
          >
            <p className="font-semibold">{t('afterSaving')}</p>
            {appear.length ? (
              <p className="flex items-start gap-1.5">
                <EyeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('navAppear', { items: appear.join(', ') })}
              </p>
            ) : null}
            {disappear.length ? (
              <p className="flex items-start gap-1.5">
                <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('navDisappear', { items: disappear.join(', ') })}
              </p>
            ) : null}
            {disappear.length ? (
              <p className="text-xs">{t('moduleDataKept')}</p>
            ) : null}
          </div>
        ) : null}
      </SaveBar>
    </div>
  )
}

/** The laboratory's size and which modules it uses. */
export function ModulesSection() {
  const settings = useLabSettings()
  if (settings.isError && !settings.data)
    return <ErrorState compact onRetry={() => void settings.refetch()} />
  if (!settings.data) return <Skeleton className="h-96 rounded-lg" />
  const { sizeTier, modules } = settings.data
  return (
    <ModulesForm
      key={JSON.stringify([sizeTier, modules])}
      initial={{ sizeTier, modules }}
    />
  )
}
