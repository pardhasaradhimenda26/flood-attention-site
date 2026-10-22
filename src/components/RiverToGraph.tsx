import { useEffect, useRef, useState } from 'react'
import { W, sections, stormGauges } from '../lib/storm'
import { useSite } from '../state'
import { approach, tpl } from '../data/content'

/*
  Act 3's teaching moment, on a real place: the Kabini valley as the HEC-RAS
  model floods it (its maximum depth in the observed 2018 event, in the page's
  depth ramp) turns into the graph the models see. The flood map fades, the
  river's centreline gives way to straight reaches between cross-sections, the
  survey lines across the river shrink into nodes, the gauge towers become
  filled nodes, reaches become arrowed edges, and last the two- and three-hop
  message links appear. One progress value drives everything; it plays once
  when scrolled into view and can be replayed. Reduced motion shows the before
  and after side by side.
*/

// Plan coordinates: the 25 m grid of plan.png. Sections are on the 50 m grid.
const S = W.cellM / W.plan.cellM
const P = (g: [number, number]) => [g[0] * S, g[1] * S] as const
const pad = 20
const xs = sections.map((s) => s.grid[0] * S)
const ys = sections.map((s) => s.grid[1] * S)
const vb = {
  x: Math.min(...xs) - pad * 4,
  y: Math.min(...ys) - pad * 4,
  w: Math.max(...xs) - Math.min(...xs) + pad * 8,
  h: Math.max(...ys) - Math.min(...ys) + pad * 8,
}
const unit = vb.w / 300 // stroke unit so lines read the same at any size

function dirAt(i: number) {
  const a = sections[Math.max(0, i - 1)].grid
  const b = sections[Math.min(sections.length - 1, i + 1)].grid
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [dx / l, dy / l] as const
}

function phase(p: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const centre = W.centreline.map((g) => P(g))
const centrePath = centre.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

function Plan({ p, label }: { p: number; label: string }) {
  const place = 1 - phase(p, 0.0, 0.35)
  const toEdges = phase(p, 0.25, 0.6)
  const toNode = phase(p, 0.35, 0.7)
  const arrows = phase(p, 0.6, 0.85)
  const message = phase(p, 0.8, 1)
  const base = `${import.meta.env.BASE_URL}wayanad/`
  const id = 'rg-arrow'
  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" />
        </marker>
      </defs>

      {/* the place: the modelled flood at its greatest extent */}
      <image href={`${base}plan.png`} x={0} y={0} width={W.plan.width} height={W.plan.height} opacity={place} style={{ imageRendering: 'pixelated' }} />
      <path d={centrePath} fill="none" stroke="var(--ink)" strokeWidth={unit * 0.8} opacity={0.6 * (1 - toEdges)} />

      {/* straight reaches between cross-sections */}
      <g opacity={toEdges}>
        {sections.slice(1).map((s, i) => {
          const [x1, y1] = P(sections[i].grid)
          const [x2, y2] = P(s.grid)
          return <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={unit * 0.9} />
        })}
      </g>
      <g opacity={arrows}>
        {sections.slice(1).map((s, i) => {
          const [x1, y1] = P(sections[i].grid)
          const [x2, y2] = P(s.grid)
          return (
            <line
              key={`a${i}`}
              x1={x1 + (x2 - x1) * 0.4}
              y1={y1 + (y2 - y1) * 0.4}
              x2={x1 + (x2 - x1) * 0.62}
              y2={y1 + (y2 - y1) * 0.62}
              stroke="var(--ink)"
              strokeWidth={unit * 0.9}
              markerEnd={`url(#${id})`}
            />
          )
        })}
      </g>
      <g opacity={message}>
        {[2, 3].flatMap((hops) =>
          sections.slice(hops).map((s, i) => {
            const [x1, y1] = P(sections[i].grid)
            const [x2, y2] = P(s.grid)
            const dx = x2 - x1
            const dy = y2 - y1
            const len = Math.hypot(dx, dy) || 1
            const bend = len * (0.12 + 0.06 * hops)
            const cx = (x1 + x2) / 2 - (dy / len) * bend
            const cy = (y1 + y2) / 2 + (dx / len) * bend
            return <path key={`m${hops}-${i}`} d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="var(--ink-soft)" strokeWidth={unit * 0.6} strokeDasharray={`${unit * 2} ${unit * 1.6}`} />
          }),
        )}
      </g>

      {/* survey lines across the river shrink into nodes */}
      {sections.map((s, i) => {
        if (s.gauged) return null
        const [x, y] = P(s.grid)
        const [dx, dy] = dirAt(i)
        const half = ((s.width_m / 2 / W.plan.cellM) + 6) * (1 - toNode)
        return (
          <g key={`s${s.id}`}>
            {half > 0.5 && <line x1={x + dy * half} y1={y - dx * half} x2={x - dy * half} y2={y + dx * half} stroke="var(--ink)" strokeWidth={unit * 0.8} />}
            <circle cx={x} cy={y} r={unit * 2.6 * toNode} fill="var(--paper)" stroke="var(--ink)" strokeWidth={unit * 0.8 * toNode} />
          </g>
        )
      })}

      {/* gauge towers become filled nodes */}
      {stormGauges.map((g) => {
        const k = sections.findIndex((s) => s.id === g.id)
        const [x, y] = P(g.section.grid)
        const [dx, dy] = dirAt(k)
        const off = ((g.section.width_m / 2 / W.plan.cellM) + 10) * (1 - toNode)
        const ox = x - dy * off
        const oy = y + dx * off
        const sz = unit * (7 - 2 * toNode)
        return (
          <g key={`g${g.id}`}>
            <rect x={ox - sz / 2} y={oy - sz / 2} width={sz} height={sz} rx={(sz / 2) * toNode} fill="var(--ink)" />
            <text x={ox} y={oy - sz / 2 - unit * 2} textAnchor="middle" fontSize={unit * 7} className="num" fill="var(--ink)">
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
  const vars = { n: sections.length, g: stormGauges.length, km: (sections[sections.length - 1]?.s_m / 1000).toFixed(0) }
  const before = tpl(m.beforeLabel, vars)
  const after = tpl(m.afterLabel, vars)
  if (reduced) {
    return (
      <figure className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-small font-semibold text-ink">{m.before}</p>
          <Plan p={0} label={before} />
        </div>
        <div>
          <p className="mb-2 text-small font-semibold text-ink">{m.after}</p>
          <Plan p={1} label={after} />
        </div>
        <figcaption className="max-w-measure text-small text-ink-soft md:col-span-2">{tpl(m.caption, vars)}</figcaption>
      </figure>
    )
  }
  return (
    <figure ref={ref}>
      <Plan p={p} label={p < 0.5 ? before : after} />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-small text-ink" aria-live="polite">
          {tpl(p < 0.3 ? m.stageRiver : p < 0.8 ? m.stageMid : m.stageGraph, vars)}
        </p>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="text-small text-ink underline decoration-ink-soft underline-offset-4 hover:decoration-ink"
        >
          {m.replay}
        </button>
      </div>
      <figcaption className="mt-3 max-w-measure text-small text-ink-soft">{tpl(m.caption, vars)}</figcaption>
    </figure>
  )
}
