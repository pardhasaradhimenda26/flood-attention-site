// @vitest-environment node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { metrics } from '../src/data/results'

const ROOT = join(__dirname, '..')
const PROV = join(ROOT, 'provenance')
const manifest = JSON.parse(readFileSync(join(PROV, 'MANIFEST.json'), 'utf8'))
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

describe('provenance/', () => {
  it('matches MANIFEST.json file for file', () => {
    for (const [rel, digest] of Object.entries(manifest.files as Record<string, string>)) {
      expect(sha(join(PROV, rel)), rel).toBe(digest)
    }
  })

  it('records a run ID and config hash for every run, and the dataset version', () => {
    expect(manifest.dataset.version).toMatch(/^[0-9a-f]{10}$/)
    for (const r of manifest.runs) {
      expect(r.configHash, r.id).toMatch(/^[0-9a-f]{10}$/)
      expect(r.id).toContain(r.configHash)
      expect(existsSync(join(PROV, 'runs', r.id, 'config.yaml')), r.id).toBe(true)
    }
  })

  it('holds the file behind every metric that names one', () => {
    for (const m of metrics) {
      if (!m.source) continue
      const rel = m.source.replace(/^provenance\//, '').replace(/ §.*$/, '')
      if (rel.includes('*')) {
        expect(existsSync(join(PROV, rel.split('/*')[0])), m.id).toBe(true)
      } else {
        expect(existsSync(join(PROV, rel)), `${m.id}: ${rel}`).toBe(true)
      }
    }
  })
})
