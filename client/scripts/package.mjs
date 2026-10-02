// Packs the production build for copying to the server:
//   dev-laboratory/          the site, ready for nginx
//   dev-laboratory.tar.gz    the same folder as one compressed file
// Run with `npm run package` (it builds first). The folder name follows the
// base path (/dev/laboratory/ -> dev-laboratory); PACKAGE_NAME overrides it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const base = (process.env.BASE_PATH ?? '/dev/laboratory/').replace(
  /^\/+|\/+$/g,
  '',
)
const name = process.env.PACKAGE_NAME ?? (base.replaceAll('/', '-') || 'site')
const folder = join(root, name)
const archive = join(root, `${name}.tar.gz`)

if (!existsSync(join(dist, 'index.html'))) {
  console.error('No build found in dist/. Run `npm run build` first.')
  process.exit(1)
}

rmSync(folder, { recursive: true, force: true })
rmSync(archive, { force: true })
cpSync(dist, folder, { recursive: true })
execFileSync('tar', ['-czf', archive, '-C', root, name])

function measure(dir) {
  let files = 0
  let bytes = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const inner = measure(path)
      files += inner.files
      bytes += inner.bytes
    } else {
      files += 1
      bytes += statSync(path).size
    }
  }
  return { files, bytes }
}

// The Content-Security-Policy allows the inline theme script by its hash
// (deploy/security-headers.conf); the hash changes whenever that script does.
const html = readFileSync(join(folder, 'index.html'), 'utf8')
const hashes = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
]
  .map((m) => m[1])
  .filter((code) => code.trim())
  .map(
    (code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`,
  )
const template = readFileSync(
  join(root, 'deploy', 'security-headers.conf'),
  'utf8',
)
const generated = join(root, 'deploy', 'security-headers.generated.conf')
writeFileSync(
  generated,
  template.replaceAll('{{SCRIPT_HASHES}}', hashes.join(' ')),
)

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`
const site = measure(folder)
console.log(`\n${name}/          ${site.files} files, ${mb(site.bytes)}`)
console.log(
  `${name}.tar.gz   ${mb(statSync(archive).size)} (copy this one file)`,
)
console.log(`\nOn the server: tar -xzf ${name}.tar.gz`)
console.log(
  `CSP script hashes: ${hashes.join(' ') || '(none)'}\nnginx headers: deploy/security-headers.generated.conf (see deploy/nginx.conf.example)`,
)
