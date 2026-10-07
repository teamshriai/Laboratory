import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArchiveIcon,
  BadgeCheckIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  FilePenLineIcon,
  InfoIcon,
  ListChecksIcon,
  PlusIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from '@/features/shared/zod'
import { DAY } from '@/domain/time'
import {
  AUTOVERIFY_CHECKS,
  DEPARTMENTS,
  type AutoVerifyCheck,
} from '@/domain/types'
import { useActor } from '@/hooks/use-permission'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type AutoVerifyRuleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import {
  useAutoVerifyRules,
  useLabSettings,
  useOrderableTests,
} from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Checkbox, FilterTabs } from '@/components/ui/toggles'
import { RULE_FILTERS, useQualityMessage, type RuleFilter } from './quality'
import { OverdueText, RuleStateBadge } from './quality-badges'

const ALWAYS: AutoVerifyCheck = 'no-critical'

function Explainer() {
  const t = useT('quality')
  const { data, isPending } = useLabSettings()
  const on = data?.autoVerifyEnabled === true
  return (
    <Card>
      <CardHeader
        icon={<ListChecksIcon />}
        tone="amber"
        title={t('avTitle')}
        description={t('avDescription')}
        action={
          isPending ? (
            <Skeleton className="h-6 w-24" />
          ) : on ? (
            <Badge tone="success">
              <CircleCheckIcon aria-hidden />
              {t('avOn')}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <CircleMinusIcon aria-hidden />
              {t('avOff')}
            </Badge>
          )
        }
      />
      <CardBody className="grid gap-3">
        <ul className="grid gap-2 text-meta text-fg-muted sm:grid-cols-2">
          {(['avPoint1', 'avPoint2', 'avPoint3', 'avPoint4'] as const).map(
            (k) => (
              <li key={k} className="flex gap-2">
                <CircleCheckIcon
                  className="mt-0.5 size-4 shrink-0 text-success-text"
                  aria-hidden
                />
                {t(k)}
              </li>
            ),
          )}
        </ul>
        {isPending ? null : (
          <p
            role="status"
            className={
              on
                ? 'flex gap-2 rounded-lg border border-info-text/25 bg-info-soft p-3 text-meta text-info-text'
                : 'flex gap-2 rounded-lg border border-line bg-surface-2 p-3 text-meta text-fg-muted'
            }
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {on ? t('avOnBody') : t('avOffBody')}{' '}
              <Link
                to="/settings?section=assistant"
                className="focus-ring rounded py-0.5 font-medium text-accent-text underline-offset-4 hover:underline"
              >
                {t('avSettingsLink')}
              </Link>
            </span>
          </p>
        )}
      </CardBody>
    </Card>
  )
}

const draftSchema = z.object({
  testId: z.string().min(1, 'forms.selectOne'),
  checks: z.array(z.enum(AUTOVERIFY_CHECKS)),
  note: z.string().trim().max(500, 'forms.invalid'),
})

function DraftDialog({
  rules,
  onClose,
}: {
  rules: AutoVerifyRuleRow[]
  onClose: () => void
}) {
  const t = useT('quality')
  const tc = useT('common')
  const e = useEnum()
  const msg = useQualityMessage()
  const { data: tests } = useOrderableTests()
  const { control, register, handleSubmit, formState } = useForm<
    z.input<typeof draftSchema>,
    unknown,
    z.output<typeof draftSchema>
  >({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      testId: '',
      checks: [ALWAYS, 'within-reference', 'no-delta-failure'],
      note: '',
    },
  })
  const hasDraft = new Set(
    rules.filter((r) => r.state === 'draft').map((r) => r.testId),
  )
  const inUse = new Map(
    rules.filter((r) => r.state === 'approved').map((r) => [r.testId, r]),
  )
  const options = DEPARTMENTS.flatMap((d) =>
    (tests ?? [])
      .filter((x) => x.department === d)
      .map((x) => ({
        value: x.id,
        label: x.name,
        group: e('department', d),
        keywords: [x.code, x.shortName],
        description: hasDraft.has(x.id)
          ? t('avHasDraft')
          : inUse.has(x.id)
            ? t('avHasRule', { version: inUse.get(x.id)!.version })
            : x.code,
      })),
  )
  const save = useLabMutation(
    (input: { testId: string; checks: AutoVerifyCheck[]; note?: string }) =>
      labApi.autoVerify.draft(input),
    {
      success: (_, v) => ({
        title: t('avDrafted', {
          test: tests?.find((x) => x.id === v.testId)?.name ?? v.testId,
        }),
        description: t('avDraftedBody'),
      }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof draftSchema>) =>
    save.mutate({
      testId: v.testId,
      checks: [...new Set<AutoVerifyCheck>([ALWAYS, ...v.checks])],
      ...(v.note ? { note: v.note } : {}),
    })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={t('avDraftTitle')}
      description={t('avDraftBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            <FilePenLineIcon />
            {t('avDraftSave')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={formState.submitCount ? countFieldErrors(formState.errors) : 0}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('avTest')}
          hint={t('avTestHint')}
          required
          error={msg(formState.errors.testId?.message)}
        >
          <Controller
            control={control}
            name="testId"
            render={({ field }) => (
              <Combobox
                value={field.value || undefined}
                onValueChange={field.onChange}
                options={options}
                placeholder={t('avTestPlaceholder')}
                searchPlaceholder={t('avTestSearch')}
                emptyText={t('avNoTests')}
              />
            )}
          />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-fg-muted">
            {t('avChecks')}
          </legend>
          <Controller
            control={control}
            name="checks"
            render={({ field }) => (
              <ul className="grid gap-2">
                {AUTOVERIFY_CHECKS.map((c) => {
                  const always = c === ALWAYS
                  const checked = always || field.value.includes(c)
                  const id = `av-check-${c}`
                  return (
                    <li
                      key={c}
                      className="flex min-h-11 items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-3"
                    >
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={checked}
                        disabled={always}
                        onCheckedChange={(on) =>
                          field.onChange(
                            on
                              ? [...field.value, c]
                              : field.value.filter((x) => x !== c),
                          )
                        }
                      />
                      <label htmlFor={id} className="min-w-0 cursor-pointer">
                        <span className="block text-sm font-medium text-fg">
                          {t(`avCheck.${c}`)}
                        </span>
                        <span className="block text-xs text-fg-muted">
                          {always ? t('avCheckAlways') : t(`avCheckHint.${c}`)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          />
        </fieldset>
        <Field
          label={t('avNote')}
          optionalLabel={tc('optional')}
          error={msg(formState.errors.note?.message)}
        >
          <Textarea {...register('note')} rows={2} maxLength={500} />
        </Field>
        <p className="flex gap-2 text-xs text-fg-subtle">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('avDraftNext')}
        </p>
      </form>
    </Dialog>
  )
}

function AuthoriseDialog({
  rule,
  onClose,
}: {
  rule: AutoVerifyRuleRow
  onClose: () => void
}) {
  const t = useT('quality')
  const actor = useActor()
  const own = actor?.id === rule.createdBy
  const save = useLabMutation(() => labApi.autoVerify.approve(rule.id), {
    success: () =>
      t('avAuthorised', { test: rule.testName, version: rule.version }),
    onSuccess: onClose,
  })
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('avAuthoriseTitle', {
        test: rule.testName,
        version: rule.version,
      })}
      description={t('avAuthoriseBody')}
      confirmLabel={t('avAuthorise')}
      loading={save.isPending}
      onConfirm={() => save.mutate()}
    >
      <div className="grid gap-3">
        <RuleChecks checks={rule.checks} />
        <p className="text-meta text-fg-muted">
          {t('avDraftedBy', { name: rule.createdByName })}
        </p>
        {own ? (
          <p
            role="status"
            className="flex gap-2 rounded-lg border border-warning-text/25 bg-warning-soft p-3 text-meta text-warning-text"
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('avOwnRule')}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  )
}

function RetireDialog({
  rule,
  onClose,
}: {
  rule: AutoVerifyRuleRow
  onClose: () => void
}) {
  const t = useT('quality')
  const tf = useT('forms')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const save = useLabMutation(
    (why: string) => labApi.autoVerify.retire(rule.id, why),
    {
      success: () =>
        t('avRetired', { test: rule.testName, version: rule.version }),
      onSuccess: onClose,
    },
  )
  const error = touched && !reason.trim() ? tf('reasonRequired') : undefined
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      tone="danger"
      title={t('avRetireTitle', {
        test: rule.testName,
        version: rule.version,
      })}
      description={t('avRetireBody')}
      confirmLabel={t('avRetire')}
      loading={save.isPending}
      onConfirm={() => {
        setTouched(true)
        if (reason.trim()) save.mutate(reason.trim())
      }}
    >
      <Field label={t('avRetireReason')} required error={error}>
        <Textarea
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
          rows={3}
          maxLength={500}
          autoFocus
        />
      </Field>
    </ConfirmDialog>
  )
}

function RuleChecks({ checks }: { checks: AutoVerifyCheck[] }) {
  const t = useT('quality')
  return (
    <ul className="grid gap-0.5">
      {AUTOVERIFY_CHECKS.filter((c) => checks.includes(c)).map((c) => (
        <li
          key={c}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap text-fg"
        >
          <CircleCheckIcon
            className="size-3 shrink-0 text-success-text"
            aria-hidden
          />
          {t(`avCheck.${c}`)}
        </li>
      ))}
    </ul>
  )
}

const matches = (filter: RuleFilter) => (r: AutoVerifyRuleRow) =>
  filter === 'all'
    ? true
    : filter === 'current'
      ? r.state !== 'retired'
      : r.state === filter

type Acting =
  | { kind: 'draft' }
  | { kind: 'authorise' | 'retire'; rule: AutoVerifyRuleRow }
  | null

export function AutoVerifyPanel() {
  const t = useT('quality')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useAutoVerifyRules()
  const filters = useUrlFilters<{ rules: RuleFilter }>(
    { rules: 'current' },
    { rules: RULE_FILTERS },
  )
  const filter = filters.values.rules
  const [acting, setActing] = useState<Acting>(null)
  const rows = data?.filter(matches(filter))
  const count = (k: RuleFilter) => data?.filter(matches(k)).length

  const columns: Column<AutoVerifyRuleRow>[] = [
    {
      id: 'test',
      header: t('avTest'),
      sortValue: (r) => r.testName,
      cell: (r) => (
        <div className="max-w-72 min-w-0">
          <p className="truncate text-meta font-medium text-fg">{r.testName}</p>
          <p className="text-xs text-fg-muted tabular-nums">
            {t('avVersion', { version: r.version })}
          </p>
        </div>
      ),
    },
    {
      id: 'checks',
      header: t('avChecks'),
      cell: (r) => <RuleChecks checks={r.checks} />,
    },
    {
      id: 'state',
      header: t('stateCol'),
      sortValue: (r) => r.state,
      cell: (r) => <RuleStateBadge state={r.state} />,
    },
    {
      id: 'created',
      header: t('avCreatedBy'),
      tabletHidden: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {r.createdByName}
          </span>
          <span className="text-xs whitespace-nowrap text-fg-muted">
            {f.date(r.createdAt)}
          </span>
        </div>
      ),
    },
    {
      id: 'authorised',
      header: t('avAuthorisedBy'),
      sortValue: (r) => r.approvedAt ?? null,
      cell: (r) =>
        r.approvedByName && r.approvedAt ? (
          <div className="grid gap-0.5">
            <span className="text-meta whitespace-nowrap text-fg">
              {r.approvedByName}
            </span>
            <span className="text-xs whitespace-nowrap text-fg-muted">
              {f.date(r.approvedAt)}
            </span>
          </div>
        ) : (
          <span className="text-meta whitespace-nowrap text-fg-subtle">-</span>
        ),
    },
    {
      id: 'review',
      header: t('avReviewDue'),
      sortValue: (r) => r.approvedAt ?? null,
      cell: (r) =>
        r.state === 'approved' && r.approvedAt ? (
          <div className="grid gap-0.5">
            <span className="text-meta whitespace-nowrap text-fg">
              {f.date(r.approvedAt + 365 * DAY)}
            </span>
            {r.reviewDue ? <OverdueText label={t('avReviewOverdue')} /> : null}
          </div>
        ) : (
          <span className="text-meta text-fg-subtle">-</span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (r) =>
        r.state === 'retired' ? null : (
          <div className="flex flex-wrap justify-end gap-2">
            {r.state === 'draft' ? (
              <GuardedButton
                permission="autoverify.approve"
                size="xs"
                variant="soft"
                aria-label={t('avAuthoriseNamed', {
                  test: r.testName,
                  version: r.version,
                })}
                onClick={() => setActing({ kind: 'authorise', rule: r })}
              >
                <BadgeCheckIcon />
                {t('avAuthorise')}
              </GuardedButton>
            ) : null}
            <GuardedButton
              permission="autoverify.manage"
              size="xs"
              aria-label={t('avRetireNamed', {
                test: r.testName,
                version: r.version,
              })}
              onClick={() => setActing({ kind: 'retire', rule: r })}
            >
              <ArchiveIcon />
              {t('avRetire')}
            </GuardedButton>
          </div>
        ),
    },
  ]

  return (
    <div className="grid gap-4">
      <Explainer />
      <Card className="overflow-hidden">
        <CardHeader
          icon={<BadgeCheckIcon />}
          tone="amber"
          title={t('avRulesTitle')}
          description={t('avRulesDescription')}
          action={
            <GuardedButton
              permission="autoverify.manage"
              variant="primary"
              onClick={() => setActing({ kind: 'draft' })}
            >
              <PlusIcon strokeWidth={2.5} />
              {t('avDraft')}
            </GuardedButton>
          }
        />
        <div className="border-b border-line px-3">
          <FilterTabs
            aria-label={t('avFilterLabel')}
            value={filter}
            onValueChange={(v) => filters.set({ rules: v })}
            items={RULE_FILTERS.map((k) => ({
              value: k,
              label: t(`ruleFilter.${k}`),
              ...(count(k) !== undefined ? { count: count(k) } : {}),
            }))}
          />
        </div>
        <DataTable
          caption={t('avRulesTitle')}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          pageSize={50}
          rowClassName={(r) => (r.reviewDue ? 'row-alert' : undefined)}
          mobile={{
            primary: 'test',
            fields: ['state', 'checks', 'authorised', 'review'],
            actions: 'actions',
          }}
          empty={
            <EmptyState
              icon={<ListChecksIcon />}
              tone="amber"
              title={t('avEmpty')}
              description={t('avEmptyBody')}
            />
          }
        />
      </Card>
      {acting?.kind === 'draft' ? (
        <DraftDialog rules={data ?? []} onClose={() => setActing(null)} />
      ) : null}
      {acting?.kind === 'authorise' ? (
        <AuthoriseDialog rule={acting.rule} onClose={() => setActing(null)} />
      ) : null}
      {acting?.kind === 'retire' ? (
        <RetireDialog rule={acting.rule} onClose={() => setActing(null)} />
      ) : null}
    </div>
  )
}
