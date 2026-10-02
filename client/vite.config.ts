/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** "/dev/laboratory" or "dev/laboratory/" become "/dev/laboratory/". */
function basePath(value = '/dev/laboratory/') {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4000'

  return {
    // The URL path the site is served under (nginx location). Override with
    // BASE_PATH=/other/path/ npm run build.
    base: basePath(env.BASE_PATH),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Source maps are two thirds of the build and browsers never load
      // them. Generate them (unlinked) only when asked: SOURCEMAP=true.
      sourcemap: env.SOURCEMAP === 'true' ? 'hidden' : false,
      // Skips gzip-measuring every file during the build.
      reportCompressedSize: false,
      rolldownOptions: {
        output: {
          // Stable vendor chunks cache across releases; the in-browser mock
          // backend is its own chunk so it can be dropped for the real API.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 40,
              },
              {
                name: 'router',
                test: /node_modules[\\/](react-router|@remix-run)[\\/]/,
                priority: 30,
              },
              {
                name: 'query',
                test: /node_modules[\\/]@tanstack[\\/]/,
                priority: 30,
              },
              {
                name: 'radix',
                test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui|cmdk)[\\/]/,
                priority: 30,
              },
              {
                name: 'forms',
                test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/,
                priority: 30,
              },
              // Icons are tiny modules shared by many screens; one chunk
              // instead of dozens of separate requests.
              {
                name: 'icons',
                test: /node_modules[\\/]lucide-react[\\/]/,
                priority: 30,
              },
              { name: 'mock', test: /[\\/]src[\\/]mock[\\/]/, priority: 20 },
              // The shared app core (primitives, hooks, helpers, rules): used
              // by every screen, so one cached file rather than dozens.
              {
                name: 'core',
                test: /[\\/]src[\\/](components[\\/]ui|hooks|lib|services|domain)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: {
      port: 5173,
      // Forward API calls to the Node backend during development.
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      },
    },
  }
})
