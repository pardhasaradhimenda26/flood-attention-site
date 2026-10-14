import { nodes } from '../data/network'
import { stormEvent } from '../data/storm'
import { gaugeName } from './graph'
import { hero, tpl } from '../data/content'

/*
  The hero's storm: one real event from the dataset (see stormEvent in
  network.ts and pick_storm in generate_data.py). Every value here is read
  from it and interpolated between hours; nothing is synthesised.
*/

export const hasStorm = stormEvent !== null

/** World units of water per metre of depth in the hero: exaggerated so a 0.7 m flood shows on a 22-unit valley. */
export const STAGE_SCALE = 0.2
export const stormHours = stormEvent?.hours ?? 1
export const lastHour = stormHours - 1

/** Index of each cross-section in the per-node uniform arrays. */
export const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

function lerpSeries(a: number[] | undefined, t: number): number {
  if (!a || !a.length) return 0
  const tc = t < 0 ? 0 : t > a.length - 1 ? a.length - 1 : t
  const i = Math.floor(tc)
  const f = tc - i
  return i + 1 < a.length ? a[i] + (a[i + 1] - a[i]) * f : a[i]
}

export function depthAt(id: string, t: number): number {
  return lerpSeries(stormEvent?.nodes[id]?.depthM, t)
}
export function rainAt(id: string, t: number): number {
  return lerpSeries(stormEvent?.nodes[id]?.rainMm, Math.floor(t))
}
export function velocityAt(id: string, t: number): number {
  return lerpSeries(stormEvent?.nodes[id]?.velocityMs, t)
}
export function dischargeAt(id: string, t: number): number | null {
  const q = stormEvent?.nodes[id]?.dischargeM3s
  return q ? lerpSeries(q, t) : null
}

/** Basin-mean rain at hour t (mm in that hour). */
export function basinRainAt(t: number): number {
  return lerpSeries(stormEvent?.basinRainMm, Math.floor(t))
}

/** Mean rain over the upstream cross-sections (mm per hour). */
export const upstreamRain: number[] = Array.from({ length: stormHours }, (_, t) => {
  const ids = stormEvent?.upstreamIds ?? []
  return ids.length ? ids.reduce((s, id) => s + rainAt(id, t), 0) / ids.length : 0
})
export const maxRain = Math.max(
  0.001,
  ...nodes.map((n) => Math.max(0, ...(stormEvent?.nodes[n.id]?.rainMm ?? [0]))),
)

export const rainPeakHour = stormEvent?.upstreamRainPeakHour ?? 0
export const outletPeakHour = stormEvent?.outletPeakHour ?? 0
export const lagHours = stormEvent?.lagHours ?? 0
export const outletId = stormEvent?.outletId ?? nodes[nodes.length - 1].id

/** The gauges, upstream to downstream, with their display names. */
export const stormGauges = (stormEvent?.gaugeIds ?? []).map((id) => {
  const n = nodes.find((x) => x.id === id)!
  return { id, name: gaugeName.get(id) ?? id, role: n.gaugeRole?.replace('_', '-') ?? '', node: n }
})

/** Hour the river carries the most water overall: where reduced motion holds. */
export const holdHour = (() => {
  let best = 0
  let bestSum = -1
  for (let t = 0; t < stormHours; t++) {
    const s = nodes.reduce((a, n) => a + depthAt(n.id, t), 0)
    if (s > bestSum) {
      bestSum = s
      best = t
    }
  }
  return best
})()

export function peakOf(id: string): { hour: number; depthM: number } {
  const d = stormEvent?.nodes[id]?.depthM ?? [0]
  let h = 0
  for (let i = 1; i < d.length; i++) if (d[i] > d[h]) h = i
  return { hour: h, depthM: d[h] }
}

/** "rising" / "falling" / "steady" at hour t, from the depth trend over ±2 h. */
export function trendAt(id: string, t: number): 'rising' | 'falling' | 'steady' {
  const d = depthAt(id, Math.min(lastHour, t + 2)) - depthAt(id, Math.max(0, t - 2))
  return d > 0.01 ? 'rising' : d < -0.01 ? 'falling' : 'steady'
}

/** The hero scene's text alternative, with this storm's numbers. */
export const sceneLabel = tpl(hero.sceneLabel, { lag: lagHours, ungauged: nodes.length - stormGauges.length })
