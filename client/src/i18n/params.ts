import type { Language } from '@/domain/types'
import { translateEnum } from './core'
import { createFormatter } from './format'

/**
 * Engine errors may carry enum values as `enum:group.value` (several joined
 * with `|`) and instants as `time:<ms>`, shown in the user's language.
 */
export function localiseParams(
  lang: Language,
  params: Record<string, string | number>,
) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string' && value.startsWith('time:')
        ? createFormatter(lang).dateTime(Number(value.slice(5)))
        : typeof value === 'string' && value.startsWith('enum:')
          ? value
              .split('|')
              .map((part) => {
                const [group, ...rest] = part.slice(5).split('.')
                return translateEnum(lang, group ?? '', rest.join('.'))
              })
              .join(', ')
          : value,
    ]),
  )
}
