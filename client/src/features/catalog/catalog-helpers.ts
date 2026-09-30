import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ReferenceRange, ResultType } from '@/domain/types'
import { useLanguage, useT } from '@/i18n/context'
import { translate, type Namespace, type TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { labApi } from '@/services/lab-api'

/** One catalog test with analytes and their current ranges. */
export const useCatalogTest = (id: string | null) =>
  useQuery({
    queryKey: ['lab', 'catalog-test', id],
    queryFn: () => labApi.catalog.get(id!),
    enabled: Boolean(id),
  })

export const RESULT_TYPE_LABEL: Record<ResultType, TKey<'catalog'>> = {
  numeric: 'resultTypeNumeric',
  select: 'resultTypeSelect',
  posneg: 'resultTypePosneg',
  text: 'resultTypeText',
  narrative: 'resultTypeNarrative',
  antibiogram: 'resultTypeAntibiogram',
}

/** Upper age bound (years) used for "no upper limit". */
export const AGE_OPEN = 200

const MESSAGE_NAMESPACES: Namespace[] = ['forms', 'errors', 'catalog']

/** Resolves "forms.x", "errors.x" and "catalog.x" validation keys to text. */
export function useFormMessage() {
  const { language } = useLanguage()
  return useCallback(
    (message: string | undefined) => {
      if (!message) return undefined
      const dot = message.indexOf('.')
      const ns = message.slice(0, dot) as Namespace
      if (dot > 0 && MESSAGE_NAMESPACES.includes(ns))
        return translate(language, ns, message.slice(dot + 1))
      return message
    },
    [language],
  )
}

/** "All ages", "12 y and over", "Under 12 y" or "1 - 12 y". */
export function useAgeBand() {
  const t = useT('catalog')
  const f = useFormat()
  return useCallback(
    (range: Pick<ReferenceRange, 'ageMin' | 'ageMax'>) => {
      const open = range.ageMax >= AGE_OPEN
      if (range.ageMin <= 0 && open) return t('ageAll')
      if (open) return t('ageFrom', { min: f.number(range.ageMin) })
      if (range.ageMin <= 0)
        return t('ageUnder', { max: f.number(range.ageMax) })
      return t('ageBand', {
        min: f.number(range.ageMin),
        max: f.number(range.ageMax),
      })
    },
    [t, f],
  )
}

const SEX_ORDER = { any: 0, M: 1, F: 2 } as const

export function sortRanges<R extends Pick<ReferenceRange, 'sex' | 'ageMin'>>(
  ranges: R[],
) {
  return ranges.toSorted(
    (a, b) => a.ageMin - b.ageMin || SEX_ORDER[a.sex] - SEX_ORDER[b.sex],
  )
}
