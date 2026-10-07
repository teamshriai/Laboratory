// Where the suites point: E2E_BASE, or `vite preview` of the production build
// (built first when dist/ is missing) on a free local port.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { CLIENT_DIR, options } from './config.mjs'

function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', fail)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => ok(port))
    })
  })
}

async function waitFor(url, ms) {
  const end = Date.now() + ms
  let last = ''
  while (Date.now() < end) {
    try {
      const res = await fetch(url)
      if (res.ok) return
      last = `HTTP ${res.status}`
    } catch (e) {
      last = String(e)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Server at ${url} did not answer: ${last}`)
}

function normalisedBasePath(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}` : ''
}

/** Returns { base, stop }; base has no trailing slash. */
export async function startServer() {
  if (options.base) {
    await waitFor(`${options.base}/`, 15000)
    return { base: options.base, stop: async () => {} }
  }
  const dist = resolve(CLIENT_DIR, 'dist', 'index.html')
  if (!existsSync(dist)) {
    console.log('dist/ is missing: running npm run build')
    const built = spawnSync('npm', ['run', 'build'], {
      cwd: CLIENT_DIR,
      stdio: 'inherit',
      env: { ...process.env, BASE_PATH: options.basePath },
    })
    if (built.status !== 0) throw new Error('npm run build failed')
  }
  const port = await freePort()
  const vite = resolve(CLIENT_DIR, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(
    process.execPath,
    [
      vite,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: CLIENT_DIR,
      env: { ...process.env, BASE_PATH: options.basePath },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  const base = `http://127.0.0.1:${port}${normalisedBasePath(options.basePath)}`
  try {
    await waitFor(`${base}/`, 30000)
  } catch (e) {
    child.kill()
    throw new Error(`${e.message}\n${output}`)
  }
  return {
    base,
    stop: async () => {
      child.kill()
    },
  }
}
