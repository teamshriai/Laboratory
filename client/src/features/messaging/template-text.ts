// Template placeholders, shared by the editor's hint list and its preview.
// The engine fills the same {placeholders} when it records a message.

export const PLACEHOLDERS = [
  'name',
  'report',
  'lab',
  'slot',
  'visit',
  'amount',
  'invoice',
] as const
export type Placeholder = (typeof PLACEHOLDERS)[number]

const TOKEN = /\{(\w+)\}/g

/** Fills {placeholders}; unknown ones stay visible so they are noticed. */
export function renderTemplate(body: string, params: Record<string, string>) {
  return body.replace(TOKEN, (all, key: string) => params[key] ?? all)
}

/** Placeholders in the text that the lab does not fill. */
export function unknownPlaceholders(body: string) {
  const known: readonly string[] = PLACEHOLDERS
  return [
    ...new Set(
      [...body.matchAll(TOKEN)]
        .map((m) => m[1] ?? '')
        .filter((key) => !known.includes(key)),
    ),
  ]
}

export const BODY_MAX = 1000
