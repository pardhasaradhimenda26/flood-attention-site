import { useEffect, useRef, useState } from 'react'
import { edges, nodes } from '../data/network'
import { nodeById, routingEdges } from '../lib/graph'
import { channelAt, halfWidth } from '../lib/terrain'
import { stormGauges } from '../lib/storm'
import { useSite } from '../state'
import { approach } from '../data/content'

/*
  Act 3's teaching moment: the river, in plan, turns into the graph. Banks
  fade, the channel collapses to its centreline, the survey lines across the
  river shrink into nodes, gauge towers become filled nodes, reaches become
  arrowed edges, and last the two- and three-hop message links appear. One
  progress value drives everything; it plays once when scrolled into view and
  can be replayed. Reduced motion shows the before and after side by side.
*/

const PAD = 1.2
const xs = nodes.map((n) => n.pos[0])
const zs = nodes.map((n) => n.pos[2])
const minX = Math.min(...xs) - PAD
const minZ = Math.min(...zs) - PAD
const W = Math.max(...xs) + PAD - minX
const H = Math.max(...zs) + PAD - minZ
const P = (id: string) => {
  const n = nodeById.get(id)!
  return [n.pos[0] - minX, n.pos[2] - minZ] as const
}
const gauged = new Set(stormGauges.map((g) => g.id))
const across = new Map(
  nodes.map((n) => {
    const c = channelAt(n.pos[0], n.pos[2])
    return [n.id, { px: -c.dirZ, pz: c.dirX, hw: c.hw }]
  }),
)
const messageEdges = edges.filter((e) => !e.routing)

/** 0..1 within [a, b] of the overall progress, eased. */
function phase(p: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function Plan({ p, label }: { p: number; label: string }) {
  const bank = 1 - phase(p, 0.0, 0.3)
  const collapse = phase(p, 0.15, 0.55)
  const toNode = phase(p, 0.35, 0.7)
  const arrows = phase(p, 0.6, 0.85)
  const message = phase(p, 0.8, 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <marker id="rg-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" />
        </marker>
      </defs>

      {/* floodplain and banks */}
      <g opacity={bank}>
        {routingEdges.map((e) => {
          const [x1, y1] = P(e.source)
          const [x2, y2] = P(e.target)
          const w = 2 * (halfWidth(nodeById.get(e.target)!.channelWidthM) + 0.55)
          return <line key={`f${e.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--paper-inset)" strokeWidth={w} strokeLinecap="round" />
        })}
        {routingEdges.map((e) => {
          const [x1, y1] = P(e.source)
          const [x2, y2] = P(e.target)
          const w = 2 * halfWidth(nodeById.get(e.target)!.channelWidthM) + 0.08
          return <line key={`b${e.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-soft)" strokeWidth={w} strokeLinecap="round" />
        })}
      </g>

      {/* the channel: true relative width, collapsing to its centreline */}
      {routingEdges.map((e) => {
        const [x1, y1] = P(e.source)
        const [x2, y2] = P(e.target)
        const full = 2 * halfWidth(nodeById.get(e.target)!.channelWidthM)
        return (
          <line
            key={`c${e.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={collapse < 0.5 ? 'var(--w3)' : 'var(--ink)'}
            strokeWidth={full + (0.05 - full) * collapse}
            strokeLinecap="round"
            markerMid={undefined}
          />
        )
      })}

      {/* edges get direction */}
      <g opacity={arrows}>
        {routingEdges.map((e) => {
          const [x1, y1] = P(e.source)
          const [x2, y2] = P(e.target)
          const mx = x1 + (x2 - x1) * 0.62
          const my = y1 + (y2 - y1) * 0.62
          return <line key={`a${e.id}`} x1={x1 + (x2 - x1) * 0.4} y1={y1 + (y2 - y1) * 0.4} x2={mx} y2={my} stroke="var(--ink)" strokeWidth={0.05} markerEnd="url(#rg-arrow)" />
        })}
      </g>

      {/* message links two and three hops long */}
      <g opacity={message}>
        {messageEdges.map((e) => {
          const [x1, y1] = P(e.source)
          const [x2, y2] = P(e.target)
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.hypot(dx, dy) || 1
          const bend = 0.25 + e.hops * 0.3
          const cx = (x1 + x2) / 2 - (dy / len) * bend
          const cy = (y1 + y2) / 2 + (dx / len) * bend
          return <path key={`m${e.id}`} d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="var(--ink-soft)" strokeWidth={0.03} strokeDasharray="0.12 0.1" />
        })}
      </g>

      {/* survey lines across the river shrink into nodes */}
      {nodes.map((n) => {
        if (gauged.has(n.id)) return null
        const [x, y] = P(n.id)
        const a = across.get(n.id)!
        const r = (a.hw + 0.2) * (1 - toNode)
        return (
          <g key={`s${n.id}`}>
            {r > 0.01 && <line x1={x - a.px * r} y1={y - a.pz * r} x2={x + a.px * r} y2={y + a.pz * r} stroke="var(--ink)" strokeWidth={0.04} />}
            <circle cx={x} cy={y} r={0.16 * toNode} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.05 * toNode} />
          </g>
        )
      })}

      {/* gauge towers become filled nodes */}
      {stormGauges.map((g) => {
        const [x, y] = P(g.id)
        const a = across.get(g.id)!
        const ox = x + a.px * (a.hw + 0.35) * (1 - toNode)
        const oy = y + a.pz * (a.hw + 0.35) * (1 - toNode)
        const s = 0.42 - 0.12 * toNode
        return (
          <g key={`g${g.id}`}>
            <rect x={ox - s / 2} y={oy - s / 2} width={s} height={s} rx={(s / 2) * toNode} fill="var(--ink)" />
            <text x={ox} y={oy - s / 2 - 0.18} textAnchor="middle" fontSize={0.42} className="num" fill="var(--ink)">
              {g.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function RiverToGraph() {
  const reduced = useSite((s) => s.reducedMotion)
  const [p, setP] = useState(0)
  const [run, setRun] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const played = useRef(false)

  // Play once when the figure is mostly in view.
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !played.current) {
          played.current = true
          setRun((r) => r + 1)
        }
      },
      { threshold: 0.45 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  useEffect(() => {
    if (!run || reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const v = Math.min(1, (now - start) / 5200)
      setP(v)
      if (v < 1) raf = requestAnimationFrame(tick)
    }
    setP(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, reduced])

  const m = approach.morph
  if (reduced) {
    return (
      <figure className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-small font-semibold text-ink">{m.before}</p>
          <Plan p={0} label={m.beforeLabel} />
        </div>
        <div>
          <p className="mb-2 text-small font-semibold text-ink">{m.after}</p>
          <Plan p={1} label={m.afterLabel} />
        </div>
        <figcaption className="max-w-measure text-small text-ink-soft md:col-span-2">{m.caption}</figcaption>
      </figure>
    )
  }
  return (
    <figure ref={ref}>
      <Plan p={p} label={p < 0.5 ? m.beforeLabel : m.afterLabel} />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-small text-ink" aria-live="polite">
          {p < 0.3 ? m.stageRiver : p < 0.8 ? m.stageMid : m.stageGraph}
        </p>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="text-small text-ink underline decoration-ink-soft underline-offset-4 hover:decoration-ink"
        >
          {m.replay}
        </button>
      </div>
      <figcaption className="mt-3 max-w-measure text-small text-ink-soft">{m.caption}</figcaption>
    </figure>
  )
}
