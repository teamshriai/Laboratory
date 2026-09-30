import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import type { SpecimenId } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type CatalogTest } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  newRangeRow,
  num,
  rangesFromRows,
  rowsFromRanges,
  type RangeRow,
} from './range-rows'

export function RangeRows({
  rows,
  onChange,
  specimens,
}: {
  rows: RangeRow[]
  onChange: (rows: RangeRow[]) => void
  specimens: SpecimenId[]
}) {
  const t = useT('catalog')
  const e = useEnum()
  const set = (key: string, patch: Partial<RangeRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  return (
    <div className="grid gap-2">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-meta text-fg-muted">
          {t('rangesEmpty')}
        </p>
      ) : null}
      {rows.length ? (
        <div className="hidden items-end gap-2 text-xs text-fg-muted sm:grid sm:grid-cols-[6rem_4.5rem_4.5rem_minmax(0,1fr)_5rem_5rem_2rem]">
          <span>{t('colSex')}</span>
          <span>{t('colAgeFrom')}</span>
          <span>{t('colAgeTo')}</span>
          <span>{t('fieldSpecimen')}</span>
          <span>{t('colLow')}</span>
          <span>{t('colHigh')}</span>
          <span />
        </div>
      ) : null}
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line p-2 sm:grid-cols-[6rem_4.5rem_4.5rem_minmax(0,1fr)_5rem_5rem_2rem] sm:items-center sm:rounded-none sm:border-0 sm:p-0"
        >
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('colSex')}
            </span>
            <Select
              size="sm"
              aria-label={t('rowSex', { n: i + 1 })}
              value={r.sex}
              onValueChange={(v) => set(r.key, { sex: v })}
              options={[
                { value: 'any' as const, label: t('sexAny') },
                { value: 'M' as const, label: e('sex', 'M') },
                { value: 'F' as const, label: e('sex', 'F') },
              ]}
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('colAgeFrom')}
            </span>
            <Input
              aria-label={t('rowAgeFrom', { n: i + 1 })}
              inputMode="decimal"
              value={r.ageMin}
              onChange={(ev) => set(r.key, { ageMin: ev.target.value })}
              className="h-8 tabular-nums"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('colAgeTo')}
            </span>
            <Input
              aria-label={t('rowAgeTo', { n: i + 1 })}
              inputMode="decimal"
              value={r.ageMax}
              placeholder={t('ageToPlaceholder')}
              onChange={(ev) => set(r.key, { ageMax: ev.target.value })}
              className="h-8 tabular-nums"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('fieldSpecimen')}
            </span>
            <Select
              size="sm"
              aria-label={t('fieldSpecimen')}
              value={r.specimen}
              onValueChange={(v) => set(r.key, { specimen: v })}
              options={[
                { value: 'any' as const, label: t('anySpecimen') },
                ...specimens.map((s) => ({
                  value: s,
                  label: e('specimen', s),
                })),
              ]}
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('colLow')}
            </span>
            <Input
              aria-label={t('rowLow', { n: i + 1 })}
              inputMode="decimal"
              value={r.low}
              onChange={(ev) => set(r.key, { low: ev.target.value })}
              className="h-8 tabular-nums"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-2xs text-fg-subtle sm:hidden">
              {t('colHigh')}
            </span>
            <Input
              aria-label={t('rowHigh', { n: i + 1 })}
              inputMode="decimal"
              value={r.high}
              onChange={(ev) => set(r.key, { high: ev.target.value })}
              className="h-8 tabular-nums"
            />
          </label>
          <IconButton
            label={t('removeRow', { n: i + 1 })}
            icon={<Trash2Icon />}
            size="icon-xs"
            onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
          />
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange([...rows, newRangeRow()])}
        >
          <PlusIcon />
          {t('addRow')}
        </Button>
      </div>
      <p className="text-xs text-fg-subtle">{t('ageToHint')}</p>
    </div>
  )
}

export function RangeEditorDialog({
  analyte,
  specimens,
  onClose,
}: {
  analyte: CatalogTest['analytes'][number]
  specimens: SpecimenId[]
  onClose: () => void
}) {
  const t = useT('catalog')
  const tc = useT('common')
  const [rows, setRows] = useState(() => rowsFromRanges(analyte.ranges))
  const [critLow, setCritLow] = useState(analyte.criticalLow?.toString() ?? '')
  const [critHigh, setCritHigh] = useState(
    analyte.criticalHigh?.toString() ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const save = useLabMutation(
    (input: Parameters<typeof labApi.catalog.saveRanges>[1]) =>
      labApi.catalog.saveRanges(analyte.id, input),
    {
      success: () => ({
        title: t('rangesSaved', { analyte: analyte.name }),
        description: t('rangesSavedBody'),
      }),
      onSuccess: onClose,
    },
  )
  const submit = () => {
    const ranges = rangesFromRows(rows)
    if (!ranges) return setError(t('rangeNeedsValue'))
    const lo = num(critLow)
    const hi = num(critHigh)
    if (lo !== null && hi !== null && lo >= hi)
      return setError(t('criticalOrder'))
    setError(null)
    save.mutate({ ranges, criticalLow: lo, criticalHigh: hi })
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={t('rangesTitle', { analyte: analyte.name })}
      description={
        analyte.unit
          ? t('rangesDescription', { unit: analyte.unit })
          : t('rangesDescriptionNoUnit')
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {t('saveRanges')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <RangeRows rows={rows} onChange={setRows} specimens={specimens} />
        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold text-fg">
            {t('sectionCritical')}
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">{t('criticalHint')}</p>
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
            <Field label={t('criticalLowLabel')}>
              <Input
                inputMode="decimal"
                value={critLow}
                onChange={(ev) => setCritLow(ev.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label={t('criticalHighLabel')}>
              <Input
                inputMode="decimal"
                value={critHigh}
                onChange={(ev) => setCritHigh(ev.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
        </section>
        <p className="text-xs text-fg-muted">{t('rangesKeepNote')}</p>
        {error ? <p className="text-meta text-danger-text">{error}</p> : null}
      </div>
    </Dialog>
  )
}
