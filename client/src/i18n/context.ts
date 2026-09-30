import { createContext, useCallback, useContext } from 'react'
import type { Language } from '@/domain/types'
import {
  translate,
  translateEnum,
  type EnumGroup,
  type EnumValue,
  type Namespace,
  type Params,
  type TKey,
} from './core'

export interface I18nState {
  language: Language
  setLanguage: (lang: Language) => void
  switching: boolean
}

export const I18nContext = createContext<I18nState>({
  language: 'en',
  setLanguage: () => {},
  switching: false,
})

export function useLanguage() {
  return useContext(I18nContext)
}

/** Translator for one namespace: `const t = useT('orders'); t('title')`. */
export function useT<N extends Namespace>(ns: N) {
  const { language } = useContext(I18nContext)
  return useCallback(
    (key: TKey<N>, params?: Params) => translate(language, ns, key, params),
    [language, ns],
  )
}

/** Translator for enumerations: `tEnum('sampleStatus', sample.status)`. */
export function useEnum() {
  const { language } = useContext(I18nContext)
  return useCallback(
    <G extends EnumGroup>(group: G, value: EnumValue<G>) =>
      translateEnum(language, group, value),
    [language],
  )
}
