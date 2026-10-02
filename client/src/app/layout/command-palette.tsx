import {
  ArrowLeftIcon,
  BellRingIcon,
  ClipboardListIcon,
  HistoryIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PackagePlusIcon,
  SearchIcon,
  PlusIcon,
  ScanLineIcon,
  ShieldCheckIcon,
  TestTubeIcon,
  UserIcon,
  UserPlusIcon,
  WrenchIcon,
} from 'lucide-react'
import { Command } from 'cmdk'
import { Dialog as D } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { labApi, type SearchExact } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useSearch } from '@/services/queries'
import { ContainerChip } from '@/components/lab/sample'
import { AgeSex } from '@/components/lab/patient'
import {
  ConnectionBadge,
  CriticalStateBadge,
  EquipmentBadge,
  ReportStatusBadge,
  SampleStatusBadge,
} from '@/components/lab/status'
import { Avatar, Kbd } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/icon-button'
import { useReturnFocus } from '@/components/ui/return-focus'
import { useRecentPatients } from '@/hooks/use-recent-patients'
import { IconTile } from '@/components/ui/icon-tile'
import { NAV_TONES, type IconTone } from '@/lib/icon-tones'
import { ADMIN_NAV, INVENTORY_NAV, LAB_NAV, OPERATIONS_NAV } from './nav-config'

function Item({
  value,
  onSelect,
  icon,
  tone = 'slate',
  children,
  meta,
  disabled,
}: {
  value: string
  disabled?: boolean
  onSelect: () => void
  icon: ReactNode
  tone?: IconTone
  children: ReactNode
  meta?: ReactNode
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg outline-none select-none data-[disabled=true]:opacity-60 data-[selected=true]:bg-surface-2"
    >
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">{children}</span>
      {meta ? <span className="shrink-0">{meta}</span> : null}
    </Command.Item>
  )
}

const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase'

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT('search')
  const tn = useT('nav')
  const e = useEnum()
  const navigate = useNavigate()
  const focus = useReturnFocus(open)
  const [query, setQuery] = useState('')
  // Receive mode: the search box takes a scanned or typed sample ID and
  // Enter receives the matching in-transit sample.
  const [receiving, setReceiving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // The API is asked once typing pauses (150 ms), not on every key.
  const deferred = useDebouncedValue(query, 150)
  const destinations = [
    ...LAB_NAV,
    ...INVENTORY_NAV,
    ...OPERATIONS_NAV,
    ...ADMIN_NAV,
  ]
  const needle = deferred.trim().toLowerCase()
  const navMatches = needle
    ? destinations.filter((d) => tn(d.key).toLowerCase().includes(needle))
    : []
  const goTo = (items: typeof destinations) => (
    <Command.Group heading={t('goTo')} className={groupClass}>
      {items.map((d) => (
        <Item
          key={d.key}
          value={`nav-${d.key}`}
          onSelect={() => go(d.to)}
          icon={d.icon}
          tone={NAV_TONES[d.key]}
        >
          {tn(d.key)}
        </Item>
      ))}
    </Command.Group>
  )
  const { data, isFetching } = useSearch(deferred)
  const results = {
    patients: data?.patients ?? [],
    orders: data?.orders ?? [],
    samples: data?.samples ?? [],
    tests: data?.tests ?? [],
    reports: data?.reports ?? [],
    equipment: data?.equipment ?? [],
    reagents: data?.reagents ?? [],
    criticals: data?.criticals ?? [],
  }
  const receive = useLabMutation((ref: string) => labApi.samples.receive(ref), {
    success: (r) => t('receivedToast', { accession: r.accessionNo ?? '' }),
    onSuccess: () => setQuery(''),
  })
  const close = () => {
    onOpenChange(false)
    setQuery('')
    setReceiving(false)
  }
  const [recentSearches, setRecentSearches] = usePersistentState<string[]>(
    'recent-searches',
    [],
  )
  const { recent } = useRecentPatients()

  const go = (to: string) => {
    if (query.trim().length >= 2)
      setRecentSearches((prev) =>
        [query.trim(), ...prev.filter((q) => q !== query.trim())].slice(0, 5),
      )
    close()
    void navigate(to)
  }

  const exactHref = (x: SearchExact) =>
    x.kind === 'specimen'
      ? `/specimens/${x.id}`
      : x.kind === 'order'
        ? `/orders?order=${x.id}`
        : x.kind === 'patient'
          ? `/patients/${x.id}`
          : `/reports/${x.id}`
  // A scanner types the number and presses Enter at once: if the results for
  // exactly this text are not in yet, look the number up and open it.
  const onEnter = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter' || receiving) return
    const term = query.trim()
    if (!/^[a-z]{2,6}-[a-z0-9-]{3,}$/i.test(term)) return
    if (deferred === query && data && !isFetching) return
    ev.preventDefault()
    void labApi.search.resolve(term).then((hit) => {
      if (hit) go(exactHref(hit))
      else toast.info(t('noExact', { query: term }))
    })
  }

  const hasQuery = deferred.trim().length >= 2
  const total = data
    ? data.patients.length +
      data.orders.length +
      data.samples.length +
      data.tests.length +
      data.reports.length +
      data.equipment.length +
      data.reagents.length +
      data.criticals.length
    : 0

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        if (o) onOpenChange(true)
        else close()
      }}
    >
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay backdrop-blur-[2px]" />
        <D.Content
          {...focus}
          className="fixed inset-x-0 top-[12dvh] z-50 mx-auto w-[calc(100vw-2rem)] max-w-2xl animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-modal outline-none"
        >
          <D.Title className="sr-only">{t('title')}</D.Title>
          <D.Description className="sr-only">{t('placeholder')}</D.Description>
          <Command shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              {receiving ? (
                <IconButton
                  label={t('back')}
                  icon={<ArrowLeftIcon />}
                  onClick={() => {
                    setReceiving(false)
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                />
              ) : null}
              <SearchIcon
                className={cn(
                  'size-5 shrink-0 text-fg-subtle',
                  isFetching && 'animate-pulse',
                )}
              />
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                onKeyDown={onEnter}
                placeholder={
                  receiving ? t('receivePlaceholder') : t('placeholder')
                }
                aria-label={receiving ? t('receiveTitle') : t('title')}
                className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60dvh,30rem)] scrollbar-thin overflow-y-auto p-2">
              {receiving ? (
                <Command.Group
                  heading={t('receiveTitle')}
                  className={groupClass}
                >
                  {!hasQuery ? (
                    <p className="px-3 pb-3 text-meta text-fg-muted">
                      {t('receiveHint')}
                    </p>
                  ) : results.samples.length === 0 && data && !isFetching ? (
                    <p className="px-3 pb-3 text-meta text-fg-muted">
                      {t('noResults', { query: deferred })}
                    </p>
                  ) : null}
                  {results.samples.map((s) => {
                    const canReceive = s.status === 'collected'
                    return (
                      <Item
                        key={s.id}
                        value={`receive-${s.id}`}
                        disabled={!canReceive || receive.isPending}
                        onSelect={() => {
                          if (canReceive && s.accessionNo)
                            receive.mutate(s.accessionNo)
                        }}
                        icon={<ScanLineIcon />}
                        tone="violet"
                        meta={
                          canReceive ? (
                            <span className="text-xs font-medium text-accent-text">
                              {t('receiveAction')}
                            </span>
                          ) : (
                            <SampleStatusBadge status={s.status} size="sm" />
                          )
                        }
                      >
                        <span className="font-mono text-meta font-medium">
                          {s.accessionNo}
                        </span>
                        <span className="block text-xs text-fg-muted">
                          {s.patientName} · {e('department', s.department)}
                        </span>
                      </Item>
                    )
                  })}
                </Command.Group>
              ) : !hasQuery ? (
                <>
                  {recent.length > 0 ? (
                    <Command.Group
                      heading={t('recentPatients')}
                      className={groupClass}
                    >
                      {recent.map((p) => (
                        <Item
                          key={p.id}
                          value={`recent-${p.id}`}
                          onSelect={() => go(`/patients/${p.id}`)}
                          icon={<HistoryIcon />}
                          tone="slate"
                        >
                          <span className="font-medium">{p.name}</span>{' '}
                          <span className="ml-1 font-mono text-xs text-fg-muted">
                            {p.uhid}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {recentSearches.length > 0 ? (
                    <Command.Group heading={t('recent')} className={groupClass}>
                      {recentSearches.map((q) => (
                        <Item
                          key={q}
                          value={`search-${q}`}
                          onSelect={() => setQuery(q)}
                          icon={<SearchIcon />}
                          tone="slate"
                        >
                          {q}
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  <Command.Group
                    heading={t('quickActions')}
                    className={groupClass}
                  >
                    <Item
                      value="register-patient"
                      onSelect={() => go('/patients?new=1')}
                      icon={<UserPlusIcon />}
                      tone="sky"
                    >
                      {t('actionRegister')}
                    </Item>
                    <Item
                      value="new-order"
                      onSelect={() => go('/orders/new')}
                      icon={<PlusIcon />}
                      tone="teal"
                    >
                      {tn('newOrder')}
                    </Item>
                    <Item
                      value="receive-sample"
                      onSelect={() => {
                        setQuery('')
                        setReceiving(true)
                        inputRef.current?.focus()
                      }}
                      icon={<ScanLineIcon />}
                      tone="violet"
                    >
                      {t('actionReceive')}
                    </Item>
                    <Item
                      value="record-qc"
                      onSelect={() => go('/quality-control?new=1')}
                      icon={<ShieldCheckIcon />}
                      tone="green"
                    >
                      {t('actionRecordQc')}
                    </Item>
                    <Item
                      value="receive-stock"
                      onSelect={() => go('/reagents?new=1')}
                      icon={<PackagePlusIcon />}
                      tone="amber"
                    >
                      {t('actionReceiveStock')}
                    </Item>
                    <Item
                      value="critical-values"
                      onSelect={() => go('/critical-results')}
                      icon={<BellRingIcon />}
                      tone="red"
                    >
                      {tn('criticalValues')}
                    </Item>
                  </Command.Group>
                  {goTo(
                    destinations.filter((d) =>
                      [
                        'workQueue',
                        'collection',
                        'validation',
                        'inventory',
                        'qualityControl',
                        'tat',
                        'analytics',
                        'equipment',
                        'testCatalog',
                      ].includes(d.key),
                    ),
                  )}
                  <p className="px-3 pt-3 pb-2 text-xs text-fg-subtle">
                    {t('hint')}
                  </p>
                </>
              ) : data &&
                total === 0 &&
                !isFetching &&
                navMatches.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-fg">
                    {t('noResults', { query: deferred })}
                  </p>
                  <p className="mt-1 text-meta text-fg-muted">
                    {t('noResultsBody')}
                  </p>
                </div>
              ) : data || navMatches.length ? (
                <>
                  {data?.exact ? (
                    <Command.Group
                      heading={t('exactMatch')}
                      className={groupClass}
                    >
                      <Item
                        value={`exact-${data.exact.kind}-${data.exact.id}`}
                        onSelect={() => go(exactHref(data.exact!))}
                        icon={
                          data.exact.kind === 'specimen' ? (
                            <TestTubeIcon />
                          ) : data.exact.kind === 'order' ? (
                            <ClipboardListIcon />
                          ) : data.exact.kind === 'patient' ? (
                            <UserIcon />
                          ) : (
                            <FileTextIcon />
                          )
                        }
                        tone="sky"
                        meta={
                          <span className="text-xs font-medium text-accent-text">
                            {t(`exactKind.${data.exact.kind}`)}
                          </span>
                        }
                      >
                        <span className="font-mono text-meta font-medium">
                          {data.exact.label}
                        </span>
                        <span className="block text-xs text-fg-muted">
                          {data.exact.patientName}
                        </span>
                      </Item>
                    </Command.Group>
                  ) : null}
                  {navMatches.length ? goTo(navMatches) : null}
                  {results.patients.length > 0 ? (
                    <Command.Group
                      heading={t('groupPatients')}
                      className={groupClass}
                    >
                      {results.patients.map((p) => (
                        <Command.Item
                          key={p.id}
                          value={`patient-${p.id}`}
                          onSelect={() => go(`/patients/${p.id}`)}
                          className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 outline-none select-none data-[selected=true]:bg-surface-2"
                        >
                          <Avatar name={p.name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">
                              {p.name}
                              {p.nameLocal ? (
                                <span
                                  lang={p.nameLocal.lang}
                                  className="ml-2 text-xs font-normal text-fg-subtle"
                                >
                                  {p.nameLocal.text}
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-xs text-fg-muted">
                              <span className="font-mono">{p.uhid}</span> ·{' '}
                              <AgeSex dob={p.dob} sex={p.sex} /> · {p.mobile}
                            </span>
                          </span>
                          <UserIcon className="size-4 text-fg-subtle" />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.samples.length > 0 ? (
                    <Command.Group
                      heading={t('groupSamples')}
                      className={groupClass}
                    >
                      {results.samples.map((s) => (
                        <Item
                          key={s.id}
                          value={`sample-${s.id}`}
                          onSelect={() => go(`/specimens/${s.id}`)}
                          icon={<TestTubeIcon />}
                          tone="violet"
                          meta={
                            <SampleStatusBadge status={s.status} size="sm" />
                          }
                        >
                          <span className="font-mono text-meta font-medium">
                            {s.accessionNo}
                          </span>
                          <span className="block text-xs text-fg-muted">
                            {s.patientName} · {e('department', s.department)} ·{' '}
                            <ContainerChip
                              container={s.container}
                              className="text-xs text-fg-muted"
                            />
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.orders.length > 0 ? (
                    <Command.Group
                      heading={t('groupOrders')}
                      className={groupClass}
                    >
                      {results.orders.map((o) => (
                        <Item
                          key={o.id}
                          value={`order-${o.id}`}
                          onSelect={() => go(`/orders?order=${o.id}`)}
                          icon={<ClipboardListIcon />}
                          tone="sky"
                        >
                          <span className="font-mono text-meta font-medium">
                            {o.orderNo}
                          </span>
                          <span className="block truncate text-xs text-fg-muted">
                            {o.patientName} · {o.tests.join(', ')}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.tests.length > 0 ? (
                    <Command.Group
                      heading={t('groupTests')}
                      className={groupClass}
                    >
                      {results.tests.map((test) => (
                        <Item
                          key={test.id}
                          value={`test-${test.id}`}
                          onSelect={() => go(`/test-catalog?test=${test.id}`)}
                          icon={<FlaskConicalIcon />}
                          tone="orange"
                        >
                          <span className="font-medium">{test.name}</span>
                          <span className="block text-xs text-fg-muted">
                            <span className="font-mono">{test.code}</span> ·{' '}
                            {e('department', test.department)}
                            {test.matchedAnalyte
                              ? ` · ${t('matchedAnalyte', { analyte: test.matchedAnalyte })}`
                              : ''}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.reports.length > 0 ? (
                    <Command.Group
                      heading={t('groupReports')}
                      className={groupClass}
                    >
                      {results.reports.map((r) => (
                        <Item
                          key={r.id}
                          value={`report-${r.id}`}
                          onSelect={() => go(`/reports/${r.id}`)}
                          icon={<FileTextIcon />}
                          tone="teal"
                          meta={
                            <ReportStatusBadge status={r.status} size="sm" />
                          }
                        >
                          <span className="font-mono text-meta font-medium">
                            {r.reportNo}
                          </span>
                          <span className="block text-xs text-fg-muted">
                            {r.patientName} · {e('department', r.department)}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.criticals.length > 0 ? (
                    <Command.Group
                      heading={t('groupCriticals')}
                      className={groupClass}
                    >
                      {results.criticals.map((c) => (
                        <Item
                          key={c.id}
                          value={`critical-${c.id}`}
                          onSelect={() =>
                            go(`/critical-results?status=all&alert=${c.id}`)
                          }
                          icon={<BellRingIcon />}
                          tone="red"
                          meta={
                            <CriticalStateBadge state={c.state} size="sm" />
                          }
                        >
                          <span className="font-medium">
                            {c.analyteName}{' '}
                            <span className="tabular-nums">
                              {c.value} {c.unit}
                            </span>
                          </span>
                          <span className="block text-xs text-fg-muted">
                            {c.patientName}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.equipment.length > 0 ? (
                    <Command.Group
                      heading={t('groupEquipment')}
                      className={groupClass}
                    >
                      {results.equipment.map((eq) => (
                        <Item
                          key={eq.id}
                          value={`equipment-${eq.id}`}
                          onSelect={() => go(`/equipment?equipment=${eq.id}`)}
                          icon={<WrenchIcon />}
                          tone="slate"
                          meta={
                            eq.connection === 'offline' ? (
                              <ConnectionBadge
                                connection={eq.connection}
                                size="sm"
                              />
                            ) : (
                              <EquipmentBadge status={eq.status} size="sm" />
                            )
                          }
                        >
                          <span className="font-medium">{eq.name}</span>
                          <span className="block text-xs text-fg-muted">
                            {eq.model} · {e('department', eq.department)} ·{' '}
                            <span className="font-mono">{eq.serialNo}</span>
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.reagents.length > 0 ? (
                    <Command.Group
                      heading={t('groupReagents')}
                      className={groupClass}
                    >
                      {results.reagents.map((r) => (
                        <Item
                          key={r.id}
                          value={`reagent-${r.id}`}
                          onSelect={() =>
                            go(
                              r.lotId
                                ? `/reagents?lot=${r.lotId}`
                                : `/reagents?reagent=${r.id}`,
                            )
                          }
                          icon={<FlaskConicalIcon />}
                          tone="amber"
                        >
                          <span className="font-medium">{r.name}</span>
                          <span className="block text-xs text-fg-muted">
                            {e('department', r.department)}
                            {r.lotNumber
                              ? ` · ${t('lotMatch', { lot: r.lotNumber })}`
                              : ''}
                            {r.lotState
                              ? ` · ${e('lotState', r.lotState)}`
                              : ''}
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2.5 text-xs text-fg-muted">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t('navigate')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Enter</Kbd> {t('select')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Esc</Kbd> {t('dismiss')}
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
