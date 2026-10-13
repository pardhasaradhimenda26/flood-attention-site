import {
  attention,
  confluenceId,
  edges,
  nodes,
  type NetEdge,
  type NetNode,
} from '../data/network'

/*
  Derived graph structure. Everything here is computed from network.ts at
  module load, so editing a travelTimeHours value there changes wave timing
  everywhere on the page — the hero, the fallback, the stage ruler.
*/

export const nodeById = new Map<string, NetNode>(nodes.map((n) => [n.id, n]))
export const routingEdges = edges.filter((e) => e.routing)

/** Routing edge leaving each node (the river is a tree: at most one). */
export const downstreamOf = new Map<string, NetEdge>()
/** All message-passing edges arriving at each node (1–3 hops). */
export const incomingAll = new Map<string, NetEdge[]>()
/** Routing (1-hop) edges arriving at each node. */
export const incomingRouting = new Map<string, NetEdge[]>()

for (const n of nodes) {
  incomingAll.set(n.id, [])
  incomingRouting.set(n.id, [])
}
for (const e of edges) {
  incomingAll.get(e.target)!.push(e)
  if (e.routing) {
    incomingRouting.get(e.target)!.push(e)
    downstreamOf.set(e.source, e)
  }
}

export const headwaters = nodes.filter((n) => incomingRouting.get(n.id)!.length === 0)
export const mainStem = nodes
  .filter((n) => n.branch === 'main')
  .sort((a, b) => a.pathPosition - b.pathPosition)
export const outlet = mainStem[mainStem.length - 1]
export const confluences = nodes.filter((n) => incomingRouting.get(n.id)!.length >= 2)
export const confluence = nodeById.get(confluenceId ?? '') ?? confluences[0]

const ROLE_ORDER = ['headwater', 'tributary', 'mid_basin', 'outlet']
export const gauges = nodes
  .filter((n) => n.gauged)
  .sort((a, b) => ROLE_ORDER.indexOf(a.gaugeRole ?? '') - ROLE_ORDER.indexOf(b.gaugeRole ?? ''))
export const gaugeName = new Map(gauges.map((g, i) => [g.id, `G${i + 1}`]))

export function roleText(role: string | null): string {
  if (!role) return 'ungauged'
  return role.replace('_', '-')
}

/* ------------------------------------------------------------------ wave */

/**
 * Width of the released storm pulse (standard deviation, hours). Each
 * headwater releases one pulse; routing is linear, so the hydrograph anywhere
 * is the superposition of every headwater's routed pulse.
 */
export const SIGMA0_H = 2.5

export type Pulse = {
  head: string
  /** relative release volume: headwater drainage area / largest headwater area */
  amp: number
  /** hours after release that the pulse centre reaches this point */
  arrival: number
  /** pulse variance at this point (h²), including the released width */
  variance: number
}

function reachVariance(e: NetEdge): number {
  if (e.dispersionHours2 != null) return e.dispersionHours2
  // Continuous Muskingum second moment, if the generator did not supply one.
  const K = e.muskingumKHours ?? e.travelTimeHours
  const X = e.muskingumX ?? 0.2
  return K * K * (1 - 2 * X)
}

const maxHeadArea = Math.max(...headwaters.map((h) => h.drainageAreaKm2))

/** Pulses passing each node, one per headwater upstream of it. */
export const pulsesAt = new Map<string, Pulse[]>()
for (const n of nodes) pulsesAt.set(n.id, [])
for (const h of headwaters) {
  const amp = h.drainageAreaKm2 / maxHeadArea
  let t = 0
  let v = SIGMA0_H * SIGMA0_H
  let cur: string | undefined = h.id
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    pulsesAt.get(cur)!.push({ head: h.id, amp, arrival: t, variance: v })
    const e = downstreamOf.get(cur)
    if (!e) break
    t += e.travelTimeHours
    v += reachVariance(e)
    cur = e.target
  }
}

export type EdgeWave = {
  edge: NetEdge
  /** pulses as they enter the edge at its source (max 4 used by the shader) */
  pulses: Pulse[]
  /** variance added over the full reach */
  dVar: number
}

export const edgeWaves: EdgeWave[] = routingEdges.map((e) => ({
  edge: e,
  pulses: pulsesAt.get(e.source)!.slice(0, 4),
  dVar: reachVariance(e),
}))

/** Main-stem headwater pulse: the reference clock for the page. */
const mainHead = mainStem[0]
export function mainArrival(nodeId: string): number {
  const p = pulsesAt.get(nodeId)?.find((q) => q.head === mainHead.id)
  return p ? p.arrival : NaN
}

export const waveDuration = Math.max(
  ...nodes.flatMap((n) => pulsesAt.get(n.id)!.map((p) => p.arrival + 3.2 * Math.sqrt(p.variance))),
)

/** Peak relative intensity a pulse reaches at a node (mass conserving). */
export function peakIntensity(p: Pulse): number {
  return (p.amp * SIGMA0_H) / Math.sqrt(p.variance)
}

/** Analytic superposed intensity at a node at time t (hours). */
export function intensityAt(nodeId: string, t: number): number {
  let s = 0
  for (const p of pulsesAt.get(nodeId)!) {
    const d = t - p.arrival
    s += peakIntensity(p) * Math.exp((-d * d) / (2 * p.variance))
  }
  return s
}

/** Time the reduced-motion view freezes at: main pulse peak at the confluence. */
export const freezeTime = Number.isFinite(mainArrival(confluence?.id ?? ''))
  ? mainArrival(confluence.id)
  : waveDuration * 0.4

/* ------------------------------------------------------------- attention */

export const hasAttention = attention !== null
export const rolloutSteps = attention?.steps ?? 12

/** Uniform aggregation: every incoming message and the node's own state weigh the same. */
export function uniformWeight(targetId: string): number {
  const d = incomingAll.get(targetId)?.length ?? 0
  return 1 / (d + 1)
}

export function learnedWeight(edgeId: number, step: number): number | null {
  if (!attention) return null
  return attention.mean[step]?.[edgeId] ?? null
}

export function learnedRange(edgeId: number, step: number): [number, number] | null {
  if (!attention) return null
  return [attention.low[step][edgeId], attention.high[step][edgeId]]
}

export function weightOf(e: NetEdge, mode: 'uniform' | 'learned', step: number): number {
  if (mode === 'learned') {
    const w = learnedWeight(e.id, step)
    if (w != null) return w
  }
  return uniformWeight(e.target)
}

/** GATv2 adds self-loops; the weight not on incoming edges sits on the node's own state. */
export function selfWeight(targetId: string, mode: 'uniform' | 'learned', step: number): number {
  const inc = incomingAll.get(targetId) ?? []
  if (mode === 'uniform') return uniformWeight(targetId)
  return Math.max(0, 1 - inc.reduce((s, e) => s + weightOf(e, 'learned', step), 0))
}

/* ------------------------------------------------------- keyboard walking */

/**
 * Arrow keys walk the graph.
 *   → / ↓  downstream (there is exactly one way down)
 *   ←      upstream, staying on the current branch where possible
 *   ↑      upstream onto the other branch at a confluence, otherwise the
 *          nearest node on the neighbouring branch
 */
export function walk(fromId: string, key: string): string {
  const here = nodeById.get(fromId)
  if (!here) return fromId
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return downstreamOf.get(fromId)?.target ?? fromId
  }
  const ups = incomingRouting.get(fromId) ?? []
  if (key === 'ArrowLeft') {
    if (!ups.length) return fromId
    const same = ups.find((e) => nodeById.get(e.source)!.branch === here.branch)
    return (same ?? ups[0]).source
  }
  if (key === 'ArrowUp') {
    const other = ups.find((e) => nodeById.get(e.source)!.branch !== here.branch)
    if (other) return other.source
    // jump to the nearest node on a different branch
    let best = fromId
    let bestD = Infinity
    for (const n of nodes) {
      if (n.branch === here.branch) continue
      const d = Math.hypot(n.pos[0] - here.pos[0], n.pos[2] - here.pos[2])
      if (d < bestD) {
        bestD = d
        best = n.id
      }
    }
    return best
  }
  return fromId
}
