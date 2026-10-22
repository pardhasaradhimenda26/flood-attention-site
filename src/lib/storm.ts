import site from '../data/wayanad.json'
import { hero, tpl } from '../data/content'

/*
  The hero's flood: event T1 of the Wayanad HEC-RAS 2D model (the observed
  August 2018 inflow at Mananthavady), exported by
  data/export_wayanad_site.py in the thesis repository. Everything here is
  read from that export and interpolated between hours; nothing is
  synthesised. The model has no rainfall: all water enters at the upstream
  boundary, so the forcing shown is the inflow hydrograph.
*/

export type Section = {
  id: string
  s_m: number
  gauged: boolean
  role: string
  /** [column, row] on the 50 m grid, from the north-west corner */
  grid: [number, number]
  utm: [number, number]
  /** WGS 84, converted from the dataset's UTM 43N */
  lat: number
  lon: number
  /** Nearest named place (OpenStreetMap), and its district and state */
  place: string
  admin: string
  bed_m: number
  width_m: number
  depth_m: number[] | null
  discharge_m3s: number[] | null
}

export type WayanadSite = {
  event: string
  eventLabel: string
  source: string
  crs: string
  originUtm: [number, number]
  cellM: number
  nx: number
  ny: number
  bedRangeM: [number, number]
  frameHours: number[]
  hourStart: number
  hourEnd: number
  startTime: string
  depthStepM: number
  /** m/s per int8 step in vel.bin */
  velStepMs: number
  nWet: number
  places: { source: string; retrieved: string | null }
  /** Latitude, longitude of the grid's north-west and south-east corners */
  corners: { nw: [number, number]; se: [number, number] }
  inflowM3s: number[]
  inflowPeakHour: number
  sections: Section[]
  centreline: [number, number][]
  lagHours: number
  plan: { width: number; height: number; cellM: number }
  files: Record<string, string>
}

export const W = site as unknown as WayanadSite
export const hasStorm = W.sections.length > 0

/** Timeline hours run 0..lastHour from the export's first hour. */
export const stormHours = W.hourEnd - W.hourStart + 1
export const lastHour = stormHours - 1

function lerp(a: number[] | null | undefined, t: number): number {
  if (!a || !a.length) return 0
  const tc = t < 0 ? 0 : t > a.length - 1 ? a.length - 1 : t
  const i = Math.floor(tc)
  const f = tc - i
  return i + 1 < a.length ? a[i] + (a[i + 1] - a[i]) * f : a[i]
}

const ordered = [...W.sections].sort((a, b) => a.s_m - b.s_m)
export const sections = ordered
const gaugedSecs = ordered.filter((s) => s.gauged)
export const stormGauges = gaugedSecs.map((s, i) => ({ id: s.id, name: `G${i + 1}`, role: s.role.replace('_', '-'), place: s.place, section: s }))
const byId = new Map(ordered.map((s) => [s.id, s]))

export const outletId = gaugedSecs[gaugedSecs.length - 1]?.id ?? ''
export const inflowId = gaugedSecs[0]?.id ?? ''

export function depthAt(id: string, t: number): number {
  return lerp(byId.get(id)?.depth_m, t)
}
export function dischargeAt(id: string, t: number): number | null {
  const q = byId.get(id)?.discharge_m3s
  return q ? lerp(q, t) : null
}
export function inflowAt(t: number): number {
  return lerp(W.inflowM3s, t)
}
export const inflow = W.inflowM3s

function argmax(a: number[]) {
  let k = 0
  for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i
  return k
}

/** Hour (timeline) of the inflow peak and of the outlet gauge's discharge peak. */
export const inflowPeakHour = W.inflowPeakHour - W.hourStart
export const outletPeakHour = argmax(byId.get(outletId)?.discharge_m3s ?? [0])
/** Measured on this event's discharge: outlet peak minus inflow peak. */
export const lagHours = outletPeakHour - inflowPeakHour

export function peakOf(id: string): { hour: number; depthM: number } {
  const d = byId.get(id)?.depth_m ?? [0]
  const h = argmax(d)
  return { hour: h, depthM: d[h] }
}

/** [column, row] on the 50 m grid at chainage s (m), between the sections either side. */
export function gridAtChainage(s: number): [number, number] {
  if (!ordered.length) return [0, 0]
  if (s <= ordered[0].s_m) return ordered[0].grid
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]
    const b = ordered[i]
    if (s <= b.s_m) {
      const f = (s - a.s_m) / Math.max(1, b.s_m - a.s_m)
      return [a.grid[0] + (b.grid[0] - a.grid[0]) * f, a.grid[1] + (b.grid[1] - a.grid[1]) * f]
    }
  }
  return ordered[ordered.length - 1].grid
}

/** Hour the river carries the most water at the gauges: where reduced motion holds. */
export const holdHour = (() => {
  let best = 0
  let bestSum = -1
  for (let t = 0; t < stormHours; t++) {
    const s = gaugedSecs.reduce((a, g) => a + depthAt(g.id, t), 0)
    if (s > bestSum) {
      bestSum = s
      best = t
    }
  }
  return best
})()

export function trendAt(id: string, t: number): 'rising' | 'falling' | 'steady' {
  const d = depthAt(id, Math.min(lastHour, t + 2)) - depthAt(id, Math.max(0, t - 2))
  return d > 0.02 ? 'rising' : d < -0.02 ? 'falling' : 'steady'
}

const START = Date.parse(W.startTime + 'Z')
/** "11 Aug, 14:00" for a timeline hour. */
export function dateAt(t: number): string {
  const d = new Date(START + (W.hourStart + Math.round(t)) * 3600_000)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  return `${d.getUTCDate()} ${mon}, ${String(d.getUTCHours()).padStart(2, '0')}:00`
}

/**
 * The hero's water surface moves with the model's velocity, sped up this many
 * times (at 1:1 a 2 m/s current takes seconds to cross a screen pixel). The
 * scale note says so.
 */
export const FLOW_SPEEDUP = 100

/** Length of the modelled reach along its centreline, km. */
export const reachKm = ordered.length ? ordered[ordered.length - 1].s_m / 1000 : 0

/** The hero scene's text alternative, with this event's numbers. */
export const sceneLabel = tpl(hero.sceneLabel, {
  lag: lagHours,
  km: reachKm.toFixed(0),
  ungauged: ordered.length - gaugedSecs.length,
  gauges: gaugedSecs.length,
})
