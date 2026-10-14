import { describe, expect, it } from 'vitest'
import { claims } from './claims'
import { glossary, plainText, termsIn } from './glossary'
import * as content from './content'
import { metric } from '../lib/metrics'

const RANK = { pending: 0, qualified: 1, verified: 2 } as const
const all = Object.values(claims)

/** Every string anywhere in content.ts, for checking glossary markers. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

describe('claims: the dual-layer contract (CLAUDE_FAS.md §4)', () => {
  it('gives every claim a plain line, a technical line and a status', () => {
    for (const c of all) {
      expect(c.plain.length, c.id).toBeGreaterThan(10)
      expect(c.technical.length, c.id).toBeGreaterThan(10)
      expect(['verified', 'qualified', 'pending']).toContain(c.status)
    }
  })

  it('keeps each plain line to one sentence, no exclamation, no jargon left unglossed', () => {
    for (const c of all) {
      const p = plainText(c.plain)
      const sentences = p.split(/(?<=[.?])\s+/).filter(Boolean)
      expect(sentences.length, `${c.id}: "${p}"`).toBe(1)
      expect(p, c.id).not.toMatch(/!/)
      expect(p.split(/\s+/).length, c.id).toBeLessThanOrEqual(28)
      for (const word of ['GAT', 'GCN', 'RMSE', 'hop-stratified', 'interval', 'bootstrap']) {
        expect(p, `${c.id} uses "${word}" in its plain line`).not.toContain(word)
      }
    }
  })

  it('sets each claim’s status to the weakest status of the metrics it cites', () => {
    for (const c of all) {
      if (!c.metrics.length) {
        expect(c.status, c.id).toBe('verified')
        continue
      }
      const weakest = c.metrics
        .map((id) => metric(id)?.status ?? 'pending')
        .reduce((a, b) => (RANK[a] <= RANK[b] ? a : b))
      expect(c.status, c.id).toBe(weakest)
    }
  })

  it('fills every number from the data: no placeholders or missing values left', () => {
    for (const c of all) {
      expect(c.technical, c.id).not.toMatch(/\{\w+\}|undefined|NaN/)
      if (c.status !== 'pending') expect(c.technical, c.id).not.toMatch(/\bpending\b/)
    }
  })

  it('resolves every glossary term a claim uses', () => {
    for (const c of all) for (const t of c.terms) expect(t.startsWith('?'), `${c.id}: ${t}`).toBe(false)
  })
})

describe('glossary', () => {
  it('defines each term once, in one plain sentence', () => {
    expect(new Set(glossary.map((t) => t.id)).size).toBe(glossary.length)
    for (const t of glossary) {
      expect(t.plain, t.id).toMatch(/\.$/)
      expect(t.plain.split(/(?<=\.)\s+/).length, t.id).toBe(1)
    }
  })

  it('resolves every [[term]] marked anywhere in the copy', () => {
    for (const s of strings(content)) {
      for (const { shown, term } of termsIn(s)) expect(term, `unknown term "${shown}" in: ${s.slice(0, 60)}`).toBeDefined()
    }
  })
})
