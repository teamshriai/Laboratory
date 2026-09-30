import { describe, expect, it } from 'vitest'
import { en } from './locales/en'
import hi from './locales/hi'
import kn from './locales/kn'
import ml from './locales/ml'
import ta from './locales/ta'

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).toSorted()

describe.each([
  ['hi', hi],
  ['kn', kn],
  ['ta', ta],
  ['ml', ml],
])('%s translations', (_, messages) => {
  for (const [ns, table] of Object.entries(messages)) {
    it(`${ns} has exactly the English keys and placeholders`, () => {
      const source = en[ns as keyof typeof en] as Record<string, string>
      const translated = table as Record<string, string>
      expect(Object.keys(translated).toSorted()).toEqual(
        Object.keys(source).toSorted(),
      )
      for (const [key, text] of Object.entries(translated)) {
        expect(text.trim(), `${ns}.${key}`).not.toBe('')
        expect(placeholders(text), `${ns}.${key}`).toEqual(
          placeholders(source[key]!),
        )
      }
    })
  }
})
