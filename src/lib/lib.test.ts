import { describe, expect, it } from 'vitest'
import { ciText, excludesZero, isPending, mv, num, parseValue } from './metrics'
import { fmt, fmtValue, minus } from './format'
import { logTicks, spreadLabels } from './chart'
import {
  edgeWaves,
  incomingAll,
  mainArrival,
  mainStem,
  nodeById,
  routingEdges,
  rolloutSteps,
  selfWeight,
  weightOf,
} from './graph'
import { hydraulics, stageMax, stageMin } from './section'

describe('format', () => {
  it('uses a typographic minus and optional plus', () => {
    expect(fmt(-0.129, 3)).toBe('−0.129')
    expect(fmt(0.017, 3, true)).toBe('+0.017')
    expect(fmt(NaN)).toBe('—')
    expect(minus('-0.129 and (-2)')).toBe('−0.129 and (−2)')
    expect(fmtValue('-15.5')).toBe('−15.5')
  })
})

describe('metrics helpers', () => {
  it('parses signed strings and fractions', () => {
    expect(parseValue('+0.017')).toBeCloseTo(0.017)
    expect(parseValue('−0.129')).toBeCloseTo(-0.129)
    expect(parseValue('17 / 24')).toBe(17)
  })

  it('treats pending metrics as absent', () => {
    expect(isPending('real_gat_vs_gcn')).toBe(true)
    expect(mv('real_gat_vs_gcn')).toBe('pending')
    expect(num('real_gat_vs_gcn')).toBeNaN()
    expect(isPending('no_such_metric')).toBe(true)
  })

  it('formats intervals and tests them against zero', () => {
    expect(ciText({ lo: -2.9, hi: 17.2, level: 0.95, method: '' })).toBe('−2.9% to +17.2%')
    expect(excludesZero({ lo: 2.5, hi: 13.6, level: 0.95, method: '' })).toBe(true)
    expect(excludesZero({ lo: -2.9, hi: 17.2, level: 0.95, method: '' })).toBe(false)
    expect(excludesZero({ lo: -0.8, hi: -0.1, level: 0.95, method: '' })).toBe(true)
    expect(excludesZero(undefined)).toBe(false)
  })
})

describe('chart arithmetic', () => {
  it('keeps log ticks inside the domain', () => {
    expect(logTicks(0.9, 9)).toEqual([1, 2, 4, 8])
    expect(logTicks(5, 6)).toEqual([])
  })

  it('spreads end labels to the minimum gap, moving them down only', () => {
    const out = spreadLabels([{ item: 'a', y: 100 }, { item: 'b', y: 95 }, { item: 'c', y: 101 }], 14)
    expect(out.map((d) => d.item)).toEqual(['b', 'a', 'c'])
    expect(out.map((d) => d.y)).toEqual([95, 109, 123])
  })
})

describe('wave arrival maths', () => {
  it('times each main-stem node by the summed travel time of the reaches above it', () => {
    for (let i = 1; i < mainStem.length; i++) {
      const prev = mainStem[i - 1]
      const reach = routingEdges.find((e) => e.source === prev.id && e.target === mainStem[i].id)
      if (!reach) continue // a tributary joins between the two
      expect(mainArrival(mainStem[i].id)).toBeCloseTo(mainArrival(prev.id) + reach.travelTimeHours, 6)
    }
  })

  it('draws one wave per routing reach, never on a message-only shortcut', () => {
    expect(edgeWaves.length).toBe(routingEdges.length)
    expect(edgeWaves.every((w) => w.edge.routing)).toBe(true)
  })
})

describe('aggregation weights', () => {
  const targets = [...incomingAll.keys()].filter((id) => (incomingAll.get(id) ?? []).length > 0)

  it('sums uniform weights and the self-loop to one at every node', () => {
    for (const id of targets) {
      const s = (incomingAll.get(id) ?? []).reduce((a, e) => a + weightOf(e, 'uniform', 0), 0) + selfWeight(id, 'uniform', 0)
      expect(s).toBeCloseTo(1, 6)
    }
  })

  it('keeps learned weights on incoming edges within a softmax budget, leaving the rest on the self-loop', () => {
    for (const id of targets) {
      for (let step = 0; step < rolloutSteps; step++) {
        const inc = (incomingAll.get(id) ?? []).reduce((a, e) => a + weightOf(e, 'learned', step), 0)
        expect(inc).toBeLessThanOrEqual(1.001)
        expect(selfWeight(id, 'learned', step)).toBeCloseTo(Math.max(0, 1 - inc), 9)
      }
    }
  })

  it('knows every node an edge points at', () => {
    for (const e of routingEdges) expect(nodeById.has(e.target)).toBe(true)
  })
})

describe('cross-section hydraulics', () => {
  it('grows area and discharge with stage', () => {
    let last = hydraulics(stageMin)
    for (let h = stageMin + 0.1; h <= stageMax; h += 0.1) {
      const now = hydraulics(h)
      expect(now.area).toBeGreaterThan(last.area)
      expect(now.discharge).toBeGreaterThan(last.discharge)
      last = now
    }
  })
})
