import { describe, expect, it } from 'vitest'
import { GLOSSARY } from '@/domain/glossary'
import { en } from './locales/en'

// Messages that quote a term on purpose (the word is about form input).
const ALLOWED = new Set(['errors.validation-failed'])

describe('terminology', () => {
  const entries = Object.entries(en).flatMap(([ns, table]) =>
    Object.entries(table as Record<string, string>).map(
      ([key, text]) => [`${ns}.${key}`, text] as const,
    ),
  )

  it.each(GLOSSARY.map((g) => [g.term, g] as const))(
    'English copy says "%s"',
    (_, rule) => {
      const offending = entries
        .filter(
          ([id, text]) =>
            !ALLOWED.has(id) &&
            // Placeholder names are code, not copy.
            rule.instead.test(text.replace(/\{\w+\}/g, '')),
        )
        .map(([id, text]) => `${id}: ${text}`)
      expect(offending).toEqual([])
    },
  )
})
