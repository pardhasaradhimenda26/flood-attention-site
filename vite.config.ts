/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { site } from './src/data/content'
import { metaDescription, noscriptHtml } from './src/lib/summary'
import { lagHours } from './src/lib/storm'

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

/**
 * The HTML shell's text, generated from results.ts: meta description, canonical
 * URL, Open Graph and Twitter tags, and a real noscript summary of the findings,
 * nulls included. Crawlers and link previews read the same numbers the page shows.
 */
function staticShell(): Plugin {
  const title = 'The flood comes down the valley. Only four places can see it.'
  return {
    name: 'static-shell',
    transformIndexHtml(html) {
      const desc = metaDescription()
      const og = `${site.url.endsWith('/') ? site.url : `${site.url}/`}og.png`
      return {
        html: html.replace('<!--static-summary-->', noscriptHtml()),
        tags: [
          ['meta', { name: 'description', content: desc }],
          ['link', { rel: 'canonical', href: site.url }],
          ['meta', { property: 'og:type', content: 'website' }],
          ['meta', { property: 'og:title', content: title }],
          ['meta', { property: 'og:description', content: desc }],
          ['meta', { property: 'og:url', content: site.url }],
          ['meta', { property: 'og:image', content: og }],
          ['meta', { property: 'og:image:width', content: '1200' }],
          ['meta', { property: 'og:image:height', content: '630' }],
          ['meta', { property: 'og:image:alt', content: `The Kabini valley in Wayanad flooding in the HEC-RAS model of the August 2018 flood, with four gauge boards reading depth and discharge, beside the headline “The flood comes down the valley. Only four places can see it.” and a timeline marking the ${lagHours}-hour lag from inflow peak to outlet peak.` }],
          ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
          ['meta', { name: 'twitter:title', content: title }],
          ['meta', { name: 'twitter:description', content: desc }],
          ['meta', { name: 'twitter:image', content: og }],
        ].map(([tag, attrs]) => ({ tag: tag as string, attrs: attrs as Record<string, string>, injectTo: 'head' as const })),
      }
    },
  }
}

// Relative base so dist/ works from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), preloadFonts(), staticShell()],
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
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 20000,
  },
})
