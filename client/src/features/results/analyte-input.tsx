import { PlusIcon } from 'lucide-react'
import type { Analyte } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/toggles'
import { focusNextField, nextFieldOnEnter } from './keyboard'

interface Props {
  analyte: Analyte
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  tone?: string
  id: string
}

export function AnalyteInput({
  analyte,
  value,
  onChange,
  disabled,
  invalid,
  tone,
  id,
}: Props) {
  const t = useT('results')
  const e = useEnum()
  /** A chosen value moves on to the next field, like Enter in a text box. */
  const choose = (v: string) => {
    onChange(v)
    window.requestAnimationFrame(() =>
      focusNextField(document.getElementById(id)),
    )
  }
  switch (analyte.resultType) {
    case 'numeric':
      return (
        <Input
          id={id}
          data-entry-field
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={nextFieldOnEnter}
          className={cn('h-9 w-full text-right font-medium tabular-nums', tone)}
        />
      )
    case 'select':
      return (
        <div data-entry-group>
          <Select
            id={id}
            value={value || undefined}
            onValueChange={choose}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            placeholder={t('selectResult')}
            options={(analyte.options ?? []).map((o) => ({
              value: o,
              label: o,
            }))}
            className={cn('w-full', tone)}
          />
        </div>
      )
    case 'posneg': {
      const style = analyte.posnegStyle ?? 'positive'
      const label = (v: 'positive' | 'negative') =>
        style === 'reactive'
          ? e('reactive', v)
          : style === 'detected'
            ? e('detected', v)
            : e('posneg', v)
      return (
        <div data-entry-group id={id} aria-invalid={invalid || undefined}>
          <Segmented
            value={value as 'positive' | 'negative' | ''}
            onValueChange={(v) => !disabled && choose(v)}
            aria-label={analyte.name}
            size="sm"
            className="w-full [&>*]:flex-1 [&>*]:justify-center"
            options={[
              { value: 'negative', label: label('negative') },
              { value: 'positive', label: label('positive') },
            ]}
          />
        </div>
      )
    }
    case 'text':
      return (
        <Input
          id={id}
          data-entry-field
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={nextFieldOnEnter}
          className="w-full"
        />
      )
    case 'narrative':
      return (
        <div className="grid gap-2">
          <Textarea
            id={id}
            data-entry-field
            value={value}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            rows={2}
            onChange={(ev) => onChange(ev.target.value)}
            className="w-full"
          />
          {analyte.templates?.length && !disabled ? (
            <div className="flex flex-wrap gap-1.5">
              {analyte.templates.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() =>
                    onChange(value ? `${value.trim()} ${tpl}` : tpl)
                  }
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-left text-xs text-fg-muted hover:border-line-strong hover:text-fg"
                >
                  <PlusIcon className="size-3 shrink-0" />
                  <span className="truncate">{tpl}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )
    case 'antibiogram': {
      let parsed: Record<string, string> = {}
      try {
        parsed = value ? (JSON.parse(value) as Record<string, string>) : {}
      } catch {
        parsed = {}
      }
      const set = (ab: string, v: string) =>
        onChange(JSON.stringify({ ...parsed, [ab]: v }))
      return (
        <div className="grid gap-1.5" data-entry-group id={id}>
          <p className="text-xs text-fg-muted">{t('antibiogramHint')}</p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {(analyte.antibiotics ?? []).map((ab) => (
              <div key={ab} className="flex items-center justify-between gap-2">
                <span className="truncate text-meta text-fg">{ab}</span>
                <Segmented
                  value={(parsed[ab] ?? '') as 'S' | 'I' | 'R' | ''}
                  onValueChange={(v) => !disabled && set(ab, v)}
                  aria-label={ab}
                  size="sm"
                  options={[
                    { value: 'S', label: 'S' },
                    { value: 'I', label: 'I' },
                    { value: 'R', label: 'R' },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }
  }
}
