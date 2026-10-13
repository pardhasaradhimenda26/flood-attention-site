// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite'

/*
  Production smoke test: build the site as it ships, then check the shell a
  crawler, a link preview or a no-JavaScript reader receives, and that every
  asset the HTML references exists in the output.
*/

const ROOT = join(__dirname, '..')
let out = ''
let html = ''

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'flood-build-'))
  await build({ root: ROOT, logLevel: 'error', build: { outDir: out, emptyOutDir: true } })
  html = readFileSync(join(out, 'index.html'), 'utf8')
}, 180_000)

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true })
})

describe('production build', () => {
  it('references only assets that exist, by relative path', () => {
    const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(2)
    for (const r of refs) expect(existsSync(join(out, r)), r).toBe(true)
  })

  it('ships the share image and the link-preview tags', () => {
    expect(existsSync(join(out, 'og.png'))).toBe(true)
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'twitter:card']) {
      expect(html, tag).toContain(tag)
    }
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+"/)
  })

  it('gives readers without JavaScript the findings, nulls included', () => {
    const ns = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'))
    expect(ns).toContain('Research question')
    expect(ns).toMatch(/Accuracy, qualified/)
    expect(ns).toMatch(/Interpretability, did not hold/)
    expect(ns).toMatch(/Real gauges, pending/)
    expect(ns).toContain('+0.017')
    expect(ns).toContain('+0.438')
  })
})
