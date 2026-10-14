import { nodes } from '../data/network'
import { nodeById, routingEdges } from './graph'

/*
  Valley topography, shared by the hero terrain mesh and the printed contour
  field on the chart-paper sections, so both show the same ground.

  Height = channel bed elevation at the nearest point of the river network,
  plus valley walls rising with distance from the channel, plus seeded
  low-frequency relief that is suppressed on the valley floor. The channel is
  carved in: a parabolic section whose half-width follows each cross-section's
  surveyed channel width, BANK_H deep, set in a near-flat floodplain.
*/

/** Depth of the carved channel below its banks (world units). */
export const BANK_H = 0.09

/** Channel half-width in world units from surveyed width in metres (drawn wider than scale, so it reads as water). */
export function halfWidth(widthM: number): number {
  return 0.16 + 0.0075 * widthM
}

type Seg = {
  ax: number
  az: number
  bx: number
  bz: number
  ay: number
  by: number
  hwa: number
  hwb: number
  source: string
  target: string
}

const segs: Seg[] = routingEdges.map((e) => {
  const A = nodeById.get(e.source)!
  const B = nodeById.get(e.target)!
  const a = A.pos
  const b = B.pos
  return {
    ax: a[0],
    az: a[2],
    ay: a[1],
    bx: b[0],
    bz: b[2],
    by: b[1],
    hwa: halfWidth(A.channelWidthM),
    hwb: halfWidth(B.channelWidthM),
    source: e.source,
    target: e.target,
  }
})

const xs = nodes.map((n) => n.pos[0])
const zs = nodes.map((n) => n.pos[2])
export const terrainBounds = {
  minX: Math.min(...xs) - 6,
  maxX: Math.max(...xs) + 6,
  minZ: Math.min(...zs) - 6,
  maxZ: Math.max(...zs) + 6,
}
export const elevRange = {
  minM: Math.min(...nodes.map((n) => n.elevationM)),
  maxM: Math.max(...nodes.map((n) => n.elevationM)),
  maxY: Math.max(...nodes.map((n) => n.pos[1])),
}

// Seeded value noise (mulberry32 lattice), deterministic across loads.
function hash(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}
function smooth(t: number) {
  return t * t * (3 - 2 * t)
}
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}
function fbm(x: number, z: number): number {
  return vnoise(x * 0.18, z * 0.18) * 0.6 + vnoise(x * 0.41 + 7, z * 0.41 - 3) * 0.3 + vnoise(x * 0.9, z * 0.9) * 0.1
}

export type ChannelPoint = {
  /** distance to the nearest reach centreline */
  d: number
  /** valley-floor elevation (world y), blended over all reaches */
  bed: number
  /** channel half-width at the nearest point */
  hw: number
  /** nearest reach: upstream and downstream cross-section, and position along it */
  source: string
  target: string
  t: number
  /** downstream unit direction of the nearest reach, in x and z */
  dirX: number
  dirZ: number
}

/** Nearest channel point at (x, z): distance, floor elevation, width and reach. */
export function channelAt(x: number, z: number): ChannelPoint {
  // Distance is to the nearest reach; floor elevation is an inverse-distance
  // blend over all reaches, so the ground has no step where the nearest
  // channel switches from a high tributary to the low main stem.
  let best = Infinity
  let bi = 0
  let bt = 0
  let wsum = 0
  let bsum = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    const vx = s.bx - s.ax
    const vz = s.bz - s.az
    const wx = x - s.ax
    const wz = z - s.az
    const len2 = vx * vx + vz * vz
    let t = len2 > 0 ? (wx * vx + wz * vz) / len2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const dx = wx - vx * t
    const dz = wz - vz * t
    const d2 = dx * dx + dz * dz
    if (d2 < best) {
      best = d2
      bi = i
      bt = t
    }
    const w = 1 / (d2 * d2 + 1e-4)
    wsum += w
    bsum += w * (s.ay + (s.by - s.ay) * t)
  }
  const s = segs[bi]
  const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1
  return {
    d: Math.sqrt(best),
    bed: bsum / wsum,
    hw: s.hwa + (s.hwb - s.hwa) * bt,
    source: s.source,
    target: s.target,
    t: bt,
    dirX: (s.bx - s.ax) / len,
    dirZ: (s.bz - s.az) / len,
  }
}

/** Floodplain and valley walls above the bank, as a function of distance from the channel edge. */
function rise(x: number, z: number, d: number, hw: number): number {
  const e = Math.max(0, d - hw)
  const wall = 0.5 * (1 - Math.exp(-(e * e) / 3.5)) + 0.05 * e
  const relief = (fbm(x, z) - 0.5) * 0.5 * Math.min(1, e / 3)
  return wall + relief
}

/** Channel bottom (world y) under the nearest centreline point: where water depth is measured from. */
export function thalwegAt(c: ChannelPoint): number {
  return c.bed - 0.12 - BANK_H
}

/** Terrain height (world y) at (x, z). */
export function terrainHeight(x: number, z: number, c: ChannelPoint = channelAt(x, z)): number {
  const u = c.d / c.hw
  const carve = u < 1 ? BANK_H * (1 - u * u) : 0
  return c.bed - 0.12 - carve + rise(x, z, c.d, c.hw)
}

/** World y back to metres above datum, for printed soundings. */
export function yToMetres(y: number): number {
  return elevRange.minM + (y / elevRange.maxY) * (elevRange.maxM - elevRange.minM)
}
