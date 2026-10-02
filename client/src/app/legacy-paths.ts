/** Old /laboratory/... paths and the pages they became. */
const RENAMED: [RegExp, string][] = [
  [/^\/laboratory\/?$/, '/dashboard'],
  [/^\/laboratory\/samples\/(.+)$/, '/specimens/$1'],
  [/^\/laboratory\/samples\/?$/, '/reception'],
  [/^\/laboratory\/results\/?$/, '/worklists'],
  [/^\/laboratory\/validation\/?$/, '/verification'],
  [/^\/laboratory\/critical-values\/?$/, '/critical-results'],
  [/^\/laboratory\/(.*)$/, '/$1'],
]

export function legacyPath(pathname: string) {
  for (const [pattern, target] of RENAMED)
    if (pattern.test(pathname)) return pathname.replace(pattern, target)
  return '/dashboard'
}
