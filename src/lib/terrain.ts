import { nodes } from '../data/network'
import { nodeById, routingEdges } from './graph'

/*
  Valley topography, shared by the hero terrain mesh and the printed contour
  field on the chart-paper sections, so both show the same ground.

  Height = channel bed elevation at the nearest point of the river network,
  plus valley walls rising with distance from the channel, plus seeded
  low-frequency relief that is suppressed on the valley floor.
*/

type Seg = { ax: number; az: number; bx: number; bz: number; ay: number; by: number }

const segs: Seg[] = routingEdges.map((e) => {
  const a = nodeById.get(e.source)!.pos
  const b = nodeById.get(e.target)!.pos
  return { ax: a[0], az: a[2], ay: a[1], bx: b[0], bz: b[2], by: b[1] }
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

/** Channel distance and bed elevation (world y) at (x, z). */
export function channelAt(x: number, z: number): { d: number; bed: number } {
  // Distance is to the nearest reach; bed elevation is an inverse-distance
  // blend over all reaches, so the ground has no step where the nearest
  // channel switches from a high tributary to the low main stem.
  let best = Infinity
  let wsum = 0
  let bsum = 0
  for (const s of segs) {
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
    if (d2 < best) best = d2
    const w = 1 / (d2 * d2 + 1e-4)
    wsum += w
    bsum += w * (s.ay + (s.by - s.ay) * t)
  }
  return { d: Math.sqrt(best), bed: bsum / wsum }
}

/** Terrain height (world y) at (x, z). */
export function terrainHeight(x: number, z: number): number {
  const { d, bed } = channelAt(x, z)
  const wall = 0.5 * (1 - Math.exp(-(d * d) / 3.5)) + 0.05 * d
  const relief = (fbm(x, z) - 0.5) * 0.5 * Math.min(1, d / 3)
  return bed - 0.12 + wall + relief
}

/** World y back to metres above datum, for printed soundings. */
export function yToMetres(y: number): number {
  return elevRange.minM + (y / elevRange.maxY) * (elevRange.maxM - elevRange.minM)
}
