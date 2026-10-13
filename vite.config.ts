import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Preload the two fonts the first screen needs (Archivo latin, Plex Mono latin 400). */
function preloadFonts(): Plugin {
  return {
    name: 'preload-critical-fonts',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return []
        return Object.keys(ctx.bundle)
          .filter((f) => /archivo-latin-wdth-normal.*\.woff2$|ibm-plex-mono-latin-400-normal.*\.woff2$/.test(f))
          .map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${f}`, crossorigin: '' },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

// Relative base so dist/ works from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), preloadFonts()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Three gets its own chunk; it, r3f and drei load only with the
        // lazily imported scenes, never on the initial page.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three'
          return undefined
        },
      },
    },
  },
})
