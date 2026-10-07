import {
  BellIcon,
  Building2Icon,
  DatabaseIcon,
  MonitorIcon,
  InfoIcon,
  AccessibilityIcon,
  BadgeCheckIcon,
  BotIcon,
  MapPinIcon,
  MoonIcon,
  BlocksIcon,
  PaletteIcon,
  SunIcon,
  LanguagesIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import {
  DEPARTMENTS,
  LANGUAGES,
  type LabSettings,
  type Language,
} from '@/domain/types'
import { accessionPrefix, nextSequence } from '@/domain/ids'
import {
  ALERT_GROUPS,
  useNotificationPrefs,
} from '@/hooks/use-notification-prefs'
import { useNow } from '@/hooks/use-now'
import { useSearchParam } from '@/hooks/use-search-param'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { useTheme, type ThemePreference } from '@/app/theme/context'
import { usePreferences } from '@/app/preferences/context'
import {
  demo as demoControls,
  labApi,
  type DemoSettings,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useDbStats, useLabSettings, useReference } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { IconTile } from '@/components/ui/icon-tile'
import type { IconTone } from '@/lib/icon-tones'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Segmented, Switch } from '@/components/ui/toggles'
import { escalationErrors } from './escalation'
import { EscalationEditor } from './escalation-editor'
import { AssistantSection } from './assistant-section'
import { ModulesSection } from './modules-section'
import { ProfileSection } from './profile-section'
import { UnsavedSettingsGuard } from './section-parts'
import {
  createDirtyStore,
  SettingsDirtyContext,
  useReportDirty,
} from './settings-dirty'
import { SitesSection } from './sites-section'

const SECTIONS = [
  'appearance',
  'language',
  'laboratory',
  'profile',
  'sites',
  'modules',
  'assistant',
  'notifications',
  'display',
  'accessibility',
  'data',
  'about',
] as const
type Section = (typeof SECTIONS)[number]

/** Each settings section keeps its own soft hue. */
const SECTION_TONES: Record<Section, IconTone> = {
  appearance: 'violet',
  language: 'teal',
  laboratory: 'blue',
  profile: 'orange',
  sites: 'green',
  modules: 'violet',
  assistant: 'sky',
  notifications: 'amber',
  display: 'indigo',
  accessibility: 'rose',
  data: 'green',
  about: 'sky',
}

/** One line in each script so the font and shaping can be checked at a glance. */
const SCRIPT_SAMPLE: Record<Language, string> = {
  en: 'Sample collected. Report ready.',
  hi: 'नमूना एकत्र किया गया। रिपोर्ट तैयार है।',
  kn: 'ಮಾದರಿ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ. ವರದಿ ಸಿದ್ಧವಾಗಿದೆ.',
  ta: 'மாதிரி சேகரிக்கப்பட்டது. அறிக்கை தயார்.',
  ml: 'സാമ്പിൾ ശേഖരിച്ചു. റിപ്പോർട്ട് തയ്യാറാണ്.',
}

function Panel({
  id,
  title,
  children,
}: {
  id: Section
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={`settings-${id}`}
      aria-labelledby={`settings-${id}-title`}
      tabIndex={-1}
      className="scroll-mt-20 outline-none"
    >
      <h2
        id={`settings-${id}-title`}
        className="mb-3 text-sm font-semibold text-fg"
      >
        {title}
      </h2>
      <Card className="p-5">{children}</Card>
    </section>
  )
}

function Row({
  title,
  hint,
  control,
}: {
  title: string
  hint?: string
  control: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function LaboratoryForm({ initial }: { initial: LabSettings }) {
  const t = useT('settings')
  const tf = useT('forms')
  const e = useEnum()
  const now = useNow()
  const [v, setV] = useState(initial)
  const [touched, setTouched] = useState(false)
  useReportDirty('laboratory', JSON.stringify(v) !== JSON.stringify(initial))
  const set = <K extends keyof LabSettings>(k: K, value: LabSettings[K]) =>
    setV((p) => ({ ...p, [k]: value }))
  const save = useLabMutation(() => labApi.system.updateSettings(v), {
    success: () => t('labSaved'),
  })
  const errors = {
    labName: !v.labName.trim() ? tf('required') : undefined,
    reportHeader: !v.reportHeader.trim() ? tf('required') : undefined,
    reportFooter: !v.reportFooter.trim() ? tf('required') : undefined,
    samplePrefix: !/^[A-Z]{2,5}$/.test(v.samplePrefix)
      ? tf('invalid')
      : undefined,
    shareLinkDays:
      !Number.isInteger(v.shareLinkDays) ||
      v.shareLinkDays < 1 ||
      v.shareLinkDays > 30
        ? t('shareLinkDaysRange')
        : undefined,
    criticalEscalation: escalationErrors(v.criticalEscalation).some(Boolean)
      ? tf('invalid')
      : undefined,
  }
  const example = nextSequence(
    [],
    accessionPrefix(now, v.samplePrefix || 'LAB'),
    5,
  )
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        className="grid gap-4 sm:grid-cols-2"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault()
          setTouched(true)
          if (!Object.values(errors).some(Boolean)) save.mutate()
        }}
      >
        <Field
          label={t('labName')}
          required
          error={touched ? errors.labName : undefined}
          className="sm:col-span-2"
        >
          <Input
            value={v.labName}
            maxLength={80}
            onChange={(ev) => set('labName', ev.target.value)}
          />
        </Field>
        <Field
          label={t('reportHeader')}
          hint={t('reportHeaderHint')}
          required
          error={touched ? errors.reportHeader : undefined}
          className="sm:col-span-2"
        >
          <Input
            value={v.reportHeader}
            maxLength={200}
            onChange={(ev) => set('reportHeader', ev.target.value)}
          />
        </Field>
        <Field
          label={t('reportFooter')}
          required
          error={touched ? errors.reportFooter : undefined}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={v.reportFooter}
            maxLength={240}
            onChange={(ev) => set('reportFooter', ev.target.value)}
          />
        </Field>
        <Field label={t('labAddress')} className="sm:col-span-2">
          <Input
            value={v.labAddress}
            maxLength={200}
            onChange={(ev) => set('labAddress', ev.target.value)}
          />
        </Field>
        <Field label={t('labRegistration')}>
          <Input
            value={v.labRegistration}
            maxLength={60}
            onChange={(ev) => set('labRegistration', ev.target.value)}
          />
        </Field>
        <Field label={t('labAccreditation')}>
          <Input
            value={v.labAccreditation}
            maxLength={60}
            onChange={(ev) => set('labAccreditation', ev.target.value)}
          />
        </Field>
        <h3 className="mt-2 text-sm font-semibold text-fg sm:col-span-2">
          {t('workflowGroup')}
        </h3>
        <div className="sm:col-span-2">
          <Row
            title={t('independentReview')}
            hint={t('independentReviewHint')}
            control={
              <Switch
                checked={v.requireIndependentReview}
                onCheckedChange={(x) => set('requireIndependentReview', x)}
                label={t('independentReview')}
              />
            }
          />
          <Row
            title={t('holdRelease')}
            hint={t('holdReleaseHint')}
            control={
              <Switch
                checked={v.holdReleaseForCriticals}
                onCheckedChange={(x) => set('holdReleaseForCriticals', x)}
                label={t('holdRelease')}
              />
            }
          />
        </div>
        <Field label={t('transitAlert')} hint={t('transitAlertHint')}>
          <Select
            value={String(v.transitAlertMin)}
            onValueChange={(x) => set('transitAlertMin', Number(x))}
            options={[30, 45, 60, 90, 120].map((n) => ({
              value: String(n),
              label: t('minutesValue', { value: n }),
            }))}
          />
        </Field>
        <Field label={t('criticalNotify')} hint={t('criticalNotifyHint')}>
          <Select
            value={String(v.criticalNotifyMin)}
            onValueChange={(x) => set('criticalNotifyMin', Number(x))}
            options={[15, 20, 30, 45, 60].map((n) => ({
              value: String(n),
              label: t('minutesValue', { value: n }),
            }))}
          />
        </Field>
        <EscalationEditor
          tiers={v.criticalEscalation}
          onChange={(x) => set('criticalEscalation', x)}
          showErrors={touched}
          className="sm:col-span-2"
        />
        <Field label={t('tatWarn')} hint={t('tatWarnHint')}>
          <Select
            value={String(v.tatWarnPct)}
            onValueChange={(x) => set('tatWarnPct', Number(x))}
            options={[60, 70, 75, 80, 90].map((n) => ({
              value: String(n),
              label: `${n}%`,
            }))}
          />
        </Field>
        <Field label={t('tatCritical')} hint={t('tatCriticalHint')}>
          <Select
            value={String(v.tatCriticalPct)}
            onValueChange={(x) => set('tatCriticalPct', Number(x))}
            options={[125, 150, 200, 250].map((n) => ({
              value: String(n),
              label: `${n}%`,
            }))}
          />
        </Field>
        <Field
          label={t('samplePrefix')}
          hint={t('samplePrefixHint', { example })}
          error={touched ? errors.samplePrefix : undefined}
        >
          <Input
            value={v.samplePrefix}
            maxLength={5}
            className="font-mono uppercase"
            onChange={(ev) =>
              set(
                'samplePrefix',
                ev.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
              )
            }
          />
        </Field>
        <Field label={t('defaultDepartment')}>
          <Select
            value={v.defaultDepartment}
            onValueChange={(x) => set('defaultDepartment', x)}
            options={[
              { value: 'all' as const, label: t('allDepartments') },
              ...DEPARTMENTS.map((d) => ({
                value: d,
                label: e('department', d),
              })),
            ]}
          />
        </Field>
        <Field label={t('defaultLanguage')}>
          <Select
            value={v.defaultLanguage}
            onValueChange={(x) => set('defaultLanguage', x)}
            options={LANGUAGES.map((l) => ({
              value: l,
              label: LANGUAGE_NAMES[l],
            }))}
          />
        </Field>
        <h3 className="mt-2 text-sm font-semibold text-fg sm:col-span-2">
          {t('reportsGroup')}
        </h3>
        <Field
          label={t('shareLinkDays')}
          hint={t('shareLinkDaysHint')}
          error={touched ? errors.shareLinkDays : undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            step={1}
            value={
              Number.isFinite(v.shareLinkDays) ? String(v.shareLinkDays) : ''
            }
            onChange={(ev) =>
              set(
                'shareLinkDays',
                ev.target.value === '' ? Number.NaN : Number(ev.target.value),
              )
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Row
            title={t('patientSummary')}
            hint={t('patientSummaryHint')}
            control={
              <Switch
                checked={v.patientSummaryOnReport}
                onCheckedChange={(x) => set('patientSummaryOnReport', x)}
                label={t('patientSummary')}
              />
            }
          />
        </div>
        <div className="flex items-end justify-end sm:col-span-2">
          <GuardedButton
            permission="settings.edit"
            type="submit"
            variant="primary"
            loading={save.isPending}
          >
            {t('saveLab')}
          </GuardedButton>
        </div>
      </form>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {t('preview')}
        </p>
        <div className="rounded-lg border border-line bg-[#ffffff] p-4 text-[#141a1f] shadow-card">
          <p className="border-b-2 border-[#2563eb] pb-2 text-sm font-bold text-[#1e3a8a]">
            {v.labName || '-'}
          </p>
          <p className="mt-1.5 text-[11px] text-[#4a5560]">{v.labAddress}</p>
          <p className="text-[11px] text-[#4a5560]">
            {[v.labRegistration, v.labAccreditation]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 text-[11px] text-[#4a5560]">{v.reportHeader}</p>
          <div className="my-3 grid gap-1">
            {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
              <span
                key={i}
                className="h-1.5 rounded bg-[#e3e8eb]"
                style={{ width: `${w * 100}%` }}
              />
            ))}
          </div>
          <p className="border-t border-[#c9d2d8] pt-2 text-[10px] text-[#5b6670]">
            {v.reportFooter}
          </p>
          <p className="mt-2 font-mono text-[10px] text-[#5b6670]">{example}</p>
        </div>
      </div>
    </div>
  )
}

export function Component() {
  const t = useT('settings')
  const f = useFormat()
  const { preference, resolved, setPreference } = useTheme()
  const { language, setLanguage } = useLanguage()
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    actorId,
    setActorId,
    density,
    setDensity,
    reduceMotion,
    setReduceMotion,
    highContrast,
    largeInterface,
    setLargeInterface,
    setHighContrast,
  } = usePreferences()
  const { prefs, set: setPref } = useNotificationPrefs()
  const [demo, setDemo] = useState<DemoSettings>(() =>
    demoControls.getSettings(),
  )
  // Storage and reset belong to the in-browser demo only.
  const sections = demoControls.enabled
    ? SECTIONS
    : SECTIONS.filter((s) => s !== 'data')
  const [active, setActive] = useSearchParam<Section>(
    'section',
    'appearance',
    sections,
  )
  // A shared link (?section=) opens at that section; later changes scroll
  // from the click itself.
  const [arrival] = useState(active)
  useEffect(() => {
    if (arrival !== 'appearance')
      document.getElementById(`settings-${arrival}`)?.scrollIntoView()
  }, [arrival])
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const settings = useLabSettings()
  const stats = useDbStats()
  const { data: reference } = useReference()
  const queryClient = useQueryClient()
  const [dirtyStore] = useState(createDirtyStore)
  const reset = useLabMutation(() => demoControls.reset(), {
    success: () => t('resetDone'),
    onSuccess: () => {
      setResetOpen(false)
      setConfirmText('')
      void queryClient.invalidateQueries()
    },
  })
  const updateDemo = (next: DemoSettings) => {
    demoControls.setSettings(next)
    setDemo(next)
  }
  const label: Record<Section, string> = {
    appearance: t('sectionAppearance'),
    language: t('sectionLanguage'),
    laboratory: t('sectionLaboratory'),
    profile: t('sectionProfile'),
    sites: t('sectionSites'),
    modules: t('sectionModules'),
    assistant: t('sectionAssistant'),
    notifications: t('sectionNotifications'),
    display: t('sectionDisplay'),
    accessibility: t('sectionAccessibility'),
    data: t('sectionData'),
    about: t('sectionAbout'),
  }
  const icons: Record<Section, ReactNode> = {
    appearance: <PaletteIcon />,
    language: <LanguagesIcon />,
    laboratory: <Building2Icon />,
    profile: <BadgeCheckIcon />,
    sites: <MapPinIcon />,
    modules: <BlocksIcon />,
    assistant: <BotIcon />,
    notifications: <BellIcon />,
    display: <MonitorIcon />,
    accessibility: <AccessibilityIcon />,
    data: <DatabaseIcon />,
    about: <InfoIcon />,
  }
  const themes: {
    value: ThemePreference
    label: string
    hint: string
    icon: ReactNode
  }[] = [
    {
      value: 'light',
      label: t('themeLight'),
      hint: t('themeLightHint'),
      icon: <SunIcon />,
    },
    {
      value: 'dark',
      label: t('themeDark'),
      hint: t('themeDarkHint'),
      icon: <MoonIcon />,
    },
    {
      value: 'system',
      label: t('themeSystem'),
      hint: t('themeSystemHint', {
        mode: resolved === 'dark' ? t('modeDark') : t('modeLight'),
      }),
      icon: <MonitorIcon />,
    },
  ]
  const staff = (reference?.staff ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )

  return (
    <SettingsDirtyContext.Provider value={dirtyStore}>
      <PageHeader title={t('title')} />
      <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          aria-label={t('title')}
          className="lg:sticky lg:top-[calc(var(--header-h,4rem)+1rem)]"
        >
          <ul className="flex gap-1 overflow-x-auto lg:grid">
            {sections.map((s) => (
              <li key={s}>
                <a
                  href={`?section=${s}`}
                  onClick={(ev) => {
                    ev.preventDefault()
                    setActive(s)
                    const target = document.getElementById(`settings-${s}`)
                    target?.scrollIntoView({ block: 'start' })
                    target?.focus({ preventScroll: true })
                  }}
                  aria-current={active === s ? 'true' : undefined}
                  className={cn(
                    'focus-ring flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm whitespace-nowrap',
                    active === s
                      ? 'bg-surface-2 font-medium text-fg'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <IconTile icon={icons[s]} tone={SECTION_TONES[s]} size="xs" />
                  {label[s]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-8">
          <Panel id="appearance" title={label.appearance}>
            <div
              role="radiogroup"
              aria-label={label.appearance}
              className="grid gap-3 sm:grid-cols-3"
            >
              {themes.map((th) => (
                <button
                  key={th.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === th.value}
                  onClick={() => setPreference(th.value)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                    preference === th.value
                      ? 'border-accent bg-accent-soft/50 ring-1 ring-accent/40'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <IconTile
                    icon={th.icon}
                    tone={
                      th.value === 'light'
                        ? 'amber'
                        : th.value === 'dark'
                          ? 'indigo'
                          : 'teal'
                    }
                    size="sm"
                  />
                  <span className="text-sm font-semibold text-fg">
                    {th.label}
                  </span>
                  <span className="text-xs text-fg-muted">{th.hint}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel id="language" title={label.language}>
            <p className="mb-4 text-meta text-fg-muted">{t('languageHint')}</p>
            <div
              role="radiogroup"
              aria-label={label.language}
              className="grid gap-2"
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={language === l}
                  onClick={() => setLanguage(l)}
                  className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-left transition-colors',
                    language === l
                      ? 'border-accent bg-accent-soft/50'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="w-28 text-sm font-semibold text-fg" lang={l}>
                    {LANGUAGE_NAMES[l]}
                  </span>
                  <span lang={l} className="flex-1 text-base text-fg-muted">
                    {SCRIPT_SAMPLE[l]}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'size-4 rounded-full border-2',
                      language === l
                        ? 'border-accent bg-accent'
                        : 'border-line-strong',
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-fg-subtle">
              {t('translationNote')}
            </p>
          </Panel>

          <Panel id="laboratory" title={label.laboratory}>
            {settings.isError && !settings.data ? (
              <ErrorState compact onRetry={() => void settings.refetch()} />
            ) : settings.data ? (
              <LaboratoryForm
                key={JSON.stringify(settings.data)}
                initial={settings.data}
              />
            ) : (
              <Skeleton className="h-72 rounded-lg" />
            )}
          </Panel>

          <Panel id="profile" title={label.profile}>
            <ProfileSection />
          </Panel>

          <Panel id="sites" title={label.sites}>
            <SitesSection />
          </Panel>

          <Panel id="modules" title={label.modules}>
            <ModulesSection />
          </Panel>

          <Panel id="assistant" title={label.assistant}>
            <AssistantSection />
          </Panel>

          <Panel id="notifications" title={label.notifications}>
            <p className="mb-3 text-meta text-fg-muted">
              {t('notificationsHint')}
            </p>
            {ALERT_GROUPS.map((g) => (
              <Row
                key={g}
                title={t(`alert.${g}`)}
                hint={t(`alert.${g}.hint`)}
                control={
                  <Switch
                    checked={prefs[g]}
                    onCheckedChange={(on) => setPref(g, on)}
                    label={t(`alert.${g}`)}
                  />
                }
              />
            ))}
          </Panel>

          <Panel id="display" title={label.display}>
            <Row
              title={t('sidebarCollapsed')}
              hint={t('sidebarCollapsedHint')}
              control={
                <Switch
                  checked={sidebarCollapsed}
                  onCheckedChange={setSidebarCollapsed}
                  label={t('sidebarCollapsed')}
                />
              }
            />
            {demoControls.enabled ? (
              <>
                <Row
                  title={t('actingAs')}
                  hint={t('actingAsHint')}
                  control={
                    <Select
                      className="w-60"
                      aria-label={t('actingAs')}
                      value={actorId}
                      onValueChange={setActorId}
                      options={staff.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                    />
                  }
                />
                <Row
                  title={t('demoLatency')}
                  hint={t('demoLatencyHint')}
                  control={
                    <Switch
                      checked={demo.latency}
                      onCheckedChange={(on) =>
                        updateDemo({ ...demo, latency: on })
                      }
                      label={t('demoLatency')}
                    />
                  }
                />
                <Row
                  title={t('demoFailures')}
                  hint={t('demoFailuresHint')}
                  control={
                    <Switch
                      checked={demo.failures}
                      onCheckedChange={(on) =>
                        updateDemo({ ...demo, failures: on })
                      }
                      label={t('demoFailures')}
                    />
                  }
                />
              </>
            ) : null}
          </Panel>

          <Panel id="accessibility" title={label.accessibility}>
            <Row
              title={t('density')}
              hint={t('densityHint')}
              control={
                <Segmented
                  size="sm"
                  value={density}
                  onValueChange={setDensity}
                  aria-label={t('density')}
                  options={[
                    { value: 'compact', label: t('densityCompact') },
                    { value: 'comfortable', label: t('densityComfortable') },
                  ]}
                />
              }
            />
            <Row
              title={t('reduceMotion')}
              hint={t('reduceMotionHint')}
              control={
                <Switch
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                  label={t('reduceMotion')}
                />
              }
            />
            <Row
              title={t('highContrast')}
              hint={t('highContrastHint')}
              control={
                <Switch
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                  label={t('highContrast')}
                />
              }
            />
            <Row
              title={t('largeInterface')}
              hint={t('largeInterfaceHint')}
              control={
                <Switch
                  checked={largeInterface}
                  onCheckedChange={setLargeInterface}
                  label={t('largeInterface')}
                />
              }
            />
          </Panel>

          {demoControls.enabled ? (
            <>
              <Panel id="data" title={label.data}>
                <Row
                  title={t('storageUsed')}
                  hint={
                    stats.data
                      ? `${t('seededOn', { time: f.dateTime(stats.data.seededAt) })} · ${stats.data.dirty ? t('modified') : t('unmodified')}`
                      : undefined
                  }
                  control={
                    <span className="text-sm font-semibold text-fg tabular-nums">
                      {stats.data
                        ? `${f.decimal(stats.data.bytes / 1024 / 1024)} MB`
                        : '-'}
                    </span>
                  }
                />
                <div className="mt-4 rounded-xl border border-danger/30 bg-danger-soft/30 p-4">
                  <div className="flex items-start gap-3">
                    <TriangleAlertIcon
                      strokeWidth={2.2}
                      className="mt-0.5 size-5 shrink-0 text-danger"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-fg">
                        {t('resetTitle')}
                      </p>
                      <p className="mt-0.5 text-meta text-fg-muted">
                        {t('resetBody')}
                      </p>
                    </div>
                    <GuardedButton
                      permission="data.reset"
                      variant="danger"
                      onClick={() => setResetOpen(true)}
                    >
                      {t('resetButton')}
                    </GuardedButton>
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          <Panel id="about" title={label.about}>
            <p className="mb-4 text-meta text-fg-muted">{t('aboutBody')}</p>
            <div className="mb-4 grid gap-2 rounded-lg bg-info-soft p-4 text-meta text-info-text">
              <p className="font-semibold">{t('demoLimitsTitle')}</p>
              <ul className="grid list-disc gap-1 pl-5">
                <li>{t('demoLimitStorage')}</li>
                <li>{t('demoLimitRoles')}</li>
                <li>{t('demoLimitAudit')}</li>
                <li>{t('demoLimitClinical')}</li>
              </ul>
            </div>
            <dl className="grid gap-3 text-meta sm:grid-cols-3">
              <div>
                <dt className="text-xs text-fg-muted">{t('version')}</dt>
                <dd className="font-medium text-fg">1.0.0</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">{t('build')}</dt>
                <dd className="font-mono text-fg">{import.meta.env.MODE}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">{t('mode')}</dt>
                <dd className="text-fg">{t('modeValue')}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={(o) => {
          setResetOpen(o)
          if (!o) setConfirmText('')
        }}
        title={t('resetTitle')}
        description={t('resetBody')}
        confirmLabel={t('resetButton')}
        tone="danger"
        disabled={confirmText !== 'RESET'}
        loading={reset.isPending}
        onConfirm={() => reset.mutate(undefined)}
      >
        <Field label={t('resetConfirmHint')}>
          <Input
            value={confirmText}
            onChange={(ev) => setConfirmText(ev.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
      </ConfirmDialog>
      <UnsavedSettingsGuard store={dirtyStore} />
    </SettingsDirtyContext.Provider>
  )
}
