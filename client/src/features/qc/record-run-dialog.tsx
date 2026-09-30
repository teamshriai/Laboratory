import { SaveIcon } from 'lucide-react'
import { useState } from 'react'
import { evaluateQc } from '@/domain/qc'
import type { QcLevel } from '@/domain/types'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type ControlLotRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { QcBadge } from '@/components/lab/status'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  formatFixed,
  formatZ,
  qcDigits,
  seriesKey,
  type QcSeries,
} from './qc-utils'

export interface RecordTarget {
  equipmentId: string
  analyteId: string
  level: QcLevel
  repeat?: boolean
}

export function RecordRunDialog({
  lots,
  series,
  initial,
  onClose,
}: {
  lots: ControlLotRow[]
  series: QcSeries[]
  initial?: RecordTarget | undefined
  onClose: () => void
}) {
  const t = useT('qc')
  const tc = useT('common')
  const f = useFormat()
  const first = initial ?? lots[0]
  const [equipmentId, setEquipmentId] = useState(first?.equipmentId ?? '')
  const [analyteId, setAnalyteId] = useState(first?.analyteId ?? '')
  const [level, setLevel] = useState<QcLevel>(first?.level ?? 'L1')
  const [value, setValue] = useState('')

  const analyzers = [
    ...new Map(lots.map((l) => [l.equipmentId, l.equipmentName])).entries(),
  ]
  const analytes = [
    ...new Map(
      lots
        .filter((l) => l.equipmentId === equipmentId)
        .map((l) => [l.analyteId, l.analyteName]),
    ).entries(),
  ]
  const levels = lots.filter(
    (l) => l.equipmentId === equipmentId && l.analyteId === analyteId,
  )
  const lot = levels.find((l) => l.level === level) ?? levels[0]
  const current = series.find((s) => lot && seriesKey(s) === seriesKey(lot))
  const digits = lot ? qcDigits(lot.mean, lot.sd) : 2
  const fmt = (n: number) => formatFixed(f.locale, n, digits)
  const numeric = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(numeric)
  const preview =
    valid && lot
      ? evaluateQc(
          numeric,
          lot.mean,
          lot.sd,
          (current?.points ?? [])
            .toReversed()
            .slice(0, 3)
            .map((p) => p.z),
        )
      : null

  const record = useLabMutation(
    () =>
      labApi.qc.record({
        equipmentId,
        analyteId,
        level: lot!.level,
        value: numeric,
      }),
    {
      success: (result) => {
        const params = {
          analyte: lot?.analyteName ?? '',
          level: t('level', { n: (lot?.level ?? 'L1').slice(1) }),
        }
        return result === 'fail'
          ? { title: t('recordedFail', params) }
          : result === 'warning'
            ? t('recordedWarning', params)
            : t('recordedPass', params)
      },
      onSuccess: onClose,
    },
  )

  const chooseAnalyzer = (id: string) => {
    setEquipmentId(id)
    const next = lots.find((l) => l.equipmentId === id)
    if (next) {
      setAnalyteId(next.analyteId)
      setLevel(next.level)
    }
  }
  const chooseAnalyte = (id: string) => {
    setAnalyteId(id)
    const next = lots.find(
      (l) => l.equipmentId === equipmentId && l.analyteId === id,
    )
    if (next) setLevel(next.level)
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial?.repeat ? t('repeatFor') : t('recordTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!valid || !lot}
            loading={record.isPending}
            onClick={() => record.mutate()}
          >
            <SaveIcon />
            {t('recordButton')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('analyzer')} className="sm:col-span-2">
            <Select
              value={equipmentId}
              onValueChange={chooseAnalyzer}
              options={analyzers.map(([v, label]) => ({ value: v, label }))}
            />
          </Field>
          <Field label={t('analyte')}>
            <Select
              value={analyteId}
              onValueChange={chooseAnalyte}
              options={analytes.map(([v, label]) => ({ value: v, label }))}
            />
          </Field>
          <Field label={t('controlLevel')}>
            <Select
              value={lot?.level ?? level}
              onValueChange={setLevel}
              options={levels.map((l) => ({
                value: l.level,
                label: t('level', { n: l.level.slice(1) }),
              }))}
            />
          </Field>
        </div>
        {lot ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-meta text-fg-muted tabular-nums">
            {t('recordFor', {
              lot: lot.lotNumber,
              mean: fmt(lot.mean),
              sd: fmt(lot.sd),
              unit: lot.unit,
            })}
          </p>
        ) : (
          <p className="text-meta text-danger-text">{t('noControlLot')}</p>
        )}
        <Field label={`${t('observed')}${lot ? ` (${lot.unit})` : ''}`}>
          <Input
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
            className="text-lg tabular-nums"
          />
        </Field>
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <span className="text-meta text-fg-muted">{t('preview')}</span>
          {preview ? (
            <span className="flex items-center gap-2 text-meta tabular-nums">
              <span className="text-fg-muted">z {formatZ(preview.z)}</span>
              {preview.rule ? (
                <span className="text-xs text-fg-muted">
                  {t(`rule.${preview.rule}`)}
                </span>
              ) : null}
              <QcBadge result={preview.result} size="sm" />
            </span>
          ) : (
            <span className="text-xs text-fg-subtle">-</span>
          )}
        </div>
      </div>
    </Dialog>
  )
}
