import { nodeById, gauges } from './graph'

/*
  One surveyed cross-section at the mid-basin gauge. The dataset gives this
  node's bankfull width, Manning's n and bed slope; the shape between the
  banks is a representative natural section (deeper on the outside of a bend,
  floodplain berms either side), scaled to that width. Hydraulics are exact
  for the polygon: area and wetted perimeter by segment clipping, discharge by
  Manning's equation.
*/

const node =
  gauges.find((g) => g.gaugeRole === 'mid_basin') ?? gauges[0] ?? nodeById.values().next().value!

export const sectionNode = node
export const manningN = node.manningN
export const bedSlope = node.channelSlope
const W = node.channelWidthM
const s = W / 28.3

/** [offset from thalweg (m), bed height above thalweg (m)] */
export const profile: [number, number][] = (
  [
    [-42, 2.6], [-30, 2.25], [-20, 1.95], [-15.6, 1.5], [-14.1, 0.95], [-11, 0.46], [-7, 0.2],
    [-3, 0.05], [0, 0], [3, 0.07], [6.5, 0.17], [10, 0.34], [13, 0.68], [14.5, 1.25],
    [17, 1.78], [26, 2.02], [42, 2.5],
  ] as [number, number][]
).map(([x, z]) => [x * s, z])

export const stageMax = 2.4
export const stageMin = 0.05
export const bankfull = 1.25

export type Hydraulics = {
  area: number
  wetted: number
  radius: number
  top: number
  discharge: number
  /** wet polygon, for drawing */
  poly: [number, number][]
}

export function hydraulics(h: number): Hydraulics {
  let area = 0
  let wetted = 0
  let top = 0
  const poly: [number, number][] = []
  for (let i = 0; i < profile.length - 1; i++) {
    let [x1, z1] = profile[i]
    let [x2, z2] = profile[i + 1]
    if (z1 >= h && z2 >= h) continue
    // clip the segment to the part below the water surface
    if (z1 > h) {
      x1 = x1 + ((h - z1) / (z2 - z1)) * (x2 - x1)
      z1 = h
    }
    if (z2 > h) {
      x2 = x1 + ((h - z1) / (z2 - z1)) * (x2 - x1)
      z2 = h
    }
    area += ((h - z1 + (h - z2)) / 2) * (x2 - x1)
    wetted += Math.hypot(x2 - x1, z2 - z1)
    top += x2 - x1
    if (!poly.length || poly[poly.length - 1][0] !== x1) poly.push([x1, z1])
    poly.push([x2, z2])
  }
  const radius = wetted > 0 ? area / wetted : 0
  const discharge = (1 / manningN) * area * Math.pow(radius, 2 / 3) * Math.sqrt(bedSlope)
  return { area, wetted, radius, top, discharge, poly }
}
