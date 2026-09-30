// Typed translation core. English is bundled and is the source of truth;
// other languages load on demand and fall back to English key by key.

import type { Language } from '@/domain/types'
import { en, type Messages } from './locales/en'

export type Namespace = keyof Messages
type KeysOf<N extends Namespace> = keyof Messages[N] & string
type PluralBase<K extends string> = K extends `${infer B}_${'one' | 'other'}`
  ? B
  : never
export type TKey<N extends Namespace> = KeysOf<N> | PluralBase<KeysOf<N>>
export type Params = Record<string, string | number>

type EnumKey = KeysOf<'enums'>
type GroupOf<K> = K extends `${infer G}.${string}` ? G : never
export type EnumGroup = GroupOf<EnumKey>
export type EnumValue<G extends string> = EnumKey extends infer K
  ? K extends `${G}.${infer V}`
    ? V
    : never
  : never

export type LocaleMessages = {
  [N in Namespace]?: Partial<Record<KeysOf<N>, string>>
}

const registry: Partial<Record<Language, LocaleMessages>> = { en }

const loaders: Record<
  Exclude<Language, 'en'>,
  () => Promise<{ default: LocaleMessages }>
> = {
  hi: () => import('./locales/hi'),
  kn: () => import('./locales/kn'),
  ta: () => import('./locales/ta'),
  ml: () => import('./locales/ml'),
}

export const INTL_LOCALE: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
}

/** Native names, shown in the language selector whatever the UI language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ்',
  ml: 'മലയാളം',
}

export async function loadLanguage(lang: Language) {
  if (registry[lang]) return
  if (lang === 'en') return
  const mod = await loaders[lang]()
  registry[lang] = mod.default
}

export function isLoaded(lang: Language) {
  return Boolean(registry[lang])
}

const pluralCache = new Map<Language, Intl.PluralRules>()
function pluralRule(lang: Language, count: number) {
  let rules = pluralCache.get(lang)
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[lang])
    pluralCache.set(lang, rules)
  }
  return rules.select(count)
}

function lookup(
  lang: Language,
  ns: Namespace,
  key: string,
): string | undefined {
  const table = registry[lang]?.[ns] as Record<string, string> | undefined
  return table?.[key]
}

export function interpolate(template: string, params?: Params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  )
}

export function translate(
  lang: Language,
  ns: Namespace,
  key: string,
  params?: Params,
): string {
  let template: string | undefined
  if (params && typeof params.count === 'number') {
    const rule = pluralRule(lang, params.count)
    template =
      lookup(lang, ns, `${key}_${rule}`) ??
      lookup(lang, ns, `${key}_other`) ??
      lookup('en', ns, `${key}_${pluralRule('en', params.count)}`) ??
      lookup('en', ns, `${key}_other`)
  }
  template ??= lookup(lang, ns, key) ?? lookup('en', ns, key) ?? key
  return interpolate(template, params)
}

export function translateEnum(lang: Language, group: string, value: string) {
  return translate(lang, 'enums', `${group}.${value}`)
}

export { en }
export type { Messages }
