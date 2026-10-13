import { describe, expect, it } from 'vitest'
import { ablations, basinComparison, metrics, provenance } from './results'

const byId = new Map(metrics.map((m) => [m.id, m]))
const get = (id: string) => {
  const m = byId.get(id)
  if (!m) throw new Error(`missing metric ${id}`)
  return m
}

describe('results.ts: the evidential-status contract', () => {
  it('gives every metric one of the three statuses and a derivation', () => {
    for (const m of metrics) {
      expect(['verified', 'qualified', 'pending']).toContain(m.status)
      expect(['recomputed', 'read']).toContain(m.derivation)
    }
  })

  it('has unique ids', () => {
    expect(new Set(metrics.map((m) => m.id)).size).toBe(metrics.length)
  })

  it('states a qualifier for every qualified metric, and only for those', () => {
    for (const m of metrics) {
      if (m.status === 'qualified') expect(m.qualifier, m.id).toBeTruthy()
      else expect(m.qualifier, m.id).toBeUndefined()
    }
  })

  it('never shows a value for a pending metric', () => {
    for (const m of metrics.filter((x) => x.status === 'pending')) expect(m.value, m.id).toBe('—')
  })

  it('traces every measured result to a run and config hash (rule 6)', () => {
    for (const m of metrics) {
      if (m.status === 'pending' || m.group === 'real') continue
      expect(m.run, m.id).toBeTruthy()
      expect(m.configHash, m.id).toBeTruthy()
      expect(m.source, m.id).toMatch(/^provenance\//)
    }
  })

  it('orders every interval and keeps the point estimate inside it', () => {
    for (const m of metrics) {
      if (!m.interval) continue
      expect(m.interval.lo, m.id).toBeLessThanOrEqual(m.interval.hi)
      expect(m.interval.level).toBe(0.95)
      const v = parseFloat(String(m.value).replace('−', '-'))
      expect(v, m.id).toBeGreaterThanOrEqual(m.interval.lo - 1e-9)
      expect(v, m.id).toBeLessThanOrEqual(m.interval.hi + 1e-9)
    }
  })
})

describe('results.ts: research-integrity rules', () => {
  it('qualifies the GAT-over-GCN gain and carries the held-out result with it (rules 1–2)', () => {
    const g = get('gat_vs_gcn')
    expect(g.status).toBe('qualified')
    expect(g.interval).toBeDefined()
    expect(g.qualifier).toMatch(/held-out/)
    expect(g.supersedes).toMatch(/p = 0\.038/)
  })

  it('keeps the held-out comparison qualified and in its own group (1.2, 2.3)', () => {
    const h = get('gat_vs_gcn_held')
    expect(h.status).toBe('qualified')
    expect(h.group).toBe('heldout')
    for (const m of metrics.filter((x) => x.group === 'model')) expect(m.label).not.toMatch(/held-out/i)
  })

  it('never shows the attention correlation without the confound baseline and seed agreement (rule 2)', () => {
    for (const id of ['att_tt_r', 'att_tt_r_routing']) {
      const q = get(id).qualifier ?? ''
      expect(q).toContain(String(get('att_confound').value))
      expect(q).toContain(String(get('att_seed_r').value))
    }
  })

  it('reports the attention nulls as nulls', () => {
    expect(get('att_tt_r').status).toBe('qualified')
    expect(get('att_tt_r').qualifier).toMatch(/chance/)
    const gap = get('att_vs_confound')
    expect(gap.interval!.hi).toBeLessThan(0)
  })

  it('keeps everything about the real network pending', () => {
    for (const id of ['real_gat_rmse', 'real_gat_vs_gcn', 'temporal_att_tt', 'undir_mechanism']) {
      expect(get(id).status).toBe('pending')
    }
  })

  it('replaces independent-pairs p-values with clustered intervals (2.2)', () => {
    for (const a of ablations ?? []) {
      expect(a).not.toHaveProperty('p')
      if (a.vsRefPct != null) expect(a.interval).not.toBeNull()
    }
    expect(get('undirected_gain').supersedes).toMatch(/as if independent/)
    expect(provenance.bootstrap.unit).toMatch(/basins and seeds/)
  })

  it('separates held-out basins from training basins in the per-basin table', () => {
    const rows = basinComparison ?? []
    expect(rows.filter((r) => r.split === 'held_out').length).toBeGreaterThan(0)
    for (const r of rows) expect(r.seedRangePct[0]).toBeLessThanOrEqual(r.seedRangePct[1])
  })

  it('names the thesis commit, dataset version and main run', () => {
    expect(provenance.thesisCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(provenance.datasetVersion).toMatch(/^[0-9a-f]{10}$/)
    expect(provenance.runs.some((r) => r.role === 'main' && r.configHash)).toBe(true)
  })
})
