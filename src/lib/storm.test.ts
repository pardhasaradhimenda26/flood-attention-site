import { describe, expect, it } from 'vitest'
import { nodes } from '../data/network'
import { stormEvent } from '../data/storm'
import { STAGE_SCALE, depthAt, lagHours, outletId, outletPeakHour, rainPeakHour, stormHours, upstreamRain } from './storm'
import { BANK_H, channelAt, terrainHeight, thalwegAt } from './terrain'

describe('the hero storm (a real event from the dataset)', () => {
  it('exists, with every cross-section, every hour', () => {
    expect(stormEvent).not.toBeNull()
    expect(Object.keys(stormEvent!.nodes).length).toBe(nodes.length)
    for (const n of nodes) expect(stormEvent!.nodes[n.id].depthM.length).toBe(stormHours)
  })

  it('rains upstream first: the headwaters get most of the first day and a half of rain', () => {
    const ids = nodes.map((n) => n.id)
    const up = new Set(stormEvent!.upstreamIds)
    let upR = 0
    let all = 0
    for (let t = 0; t < 36; t++) {
      for (const id of ids) {
        const r = stormEvent!.nodes[id].rainMm[t]
        all += r
        if (up.has(id)) upR += (r * ids.length) / up.size
      }
    }
    expect(upR / ids.length).toBeGreaterThan(all / ids.length)
  })

  it('shows a lag you can measure: nothing at the outlet for a day after the rain peaks', () => {
    expect(lagHours).toBeGreaterThan(48)
    expect(outletPeakHour - rainPeakHour).toBe(lagHours)
    const base = depthAt(outletId, 0)
    for (let t = 0; t <= rainPeakHour + 24; t++) expect(depthAt(outletId, t)).toBeLessThan(base * 1.08)
    expect(depthAt(outletId, outletPeakHour)).toBeGreaterThan(base * 1.5)
    expect(Math.max(...upstreamRain)).toBeCloseTo(upstreamRain[rainPeakHour], 6)
  })
})

describe('the valley floods along the terrain', () => {
  /** Farthest distance from the centreline still under water, walking across the river at a node. */
  function wetHalfWidth(id: string, stageM: number) {
    const n = nodes.find((x) => x.id === id)!
    const c = channelAt(n.pos[0], n.pos[2])
    const px = -c.dirZ
    const pz = c.dirX
    let wet = 0
    for (let d = 0; d < 2.5; d += 0.01) {
      const x = n.pos[0] + px * d
      const z = n.pos[2] + pz * d
      const surf = thalwegAt(channelAt(x, z)) + stageM * STAGE_SCALE
      if (surf > terrainHeight(x, z)) wet = d
      else break
    }
    return { wet, hw: c.hw }
  }

  it('keeps base flow inside the channel and spreads the peak over the floodplain', () => {
    const base = depthAt(outletId, 0)
    const peak = depthAt(outletId, outletPeakHour)
    expect(base * STAGE_SCALE).toBeLessThan(BANK_H)
    expect(peak * STAGE_SCALE).toBeGreaterThan(BANK_H)
    const lo = wetHalfWidth(outletId, base)
    const hi = wetHalfWidth(outletId, peak)
    expect(lo.wet).toBeLessThan(lo.hw)
    expect(hi.wet).toBeGreaterThan(hi.hw)
  })

  it('wets more ground, never less, as the water rises', () => {
    let prev = 0
    for (let s = 0.1; s <= 0.8; s += 0.1) {
      const w = wetHalfWidth(outletId, s).wet
      expect(w).toBeGreaterThanOrEqual(prev)
      prev = w
    }
  })
})
