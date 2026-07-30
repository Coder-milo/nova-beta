import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import vercel from '@astrojs/vercel'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url))

/**
 * El adaptador depende de dónde se construya.
 *
 * Vercel define `VERCEL=1` en sus builds, así que ahí se compila a funciones
 * serverless; en cualquier otro sitio —local, Docker, un VPS— se sigue
 * generando el servidor Node de siempre. Se detecta en vez de fijarlo para que
 * `pnpm build` local no empiece a producir artefactos que solo Vercel sabe
 * arrancar, que es lo que rompe el `docker compose` de un compañero sin que
 * nadie entienda por qué.
 */
const enVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  output: 'server',
  adapter: enVercel ? vercel() : node({ mode: 'standalone' }),
  integrations: [react()],
  server: {
    host: true,
    port: 3000,
  },
  vite: {
    // Evita que Windows deje la caché bloqueada dentro de node_modules.
    cacheDir: fromRoot('./.vite-cache'),
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fromRoot('./src'),
      },
    },
  },
})
