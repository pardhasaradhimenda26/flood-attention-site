import { useMemo, type CSSProperties } from 'react'
import { edges, nodes, type NetEdge } from '../data/network'
import {
  edgeWaves,
  freezeTime,
  gaugeName,
  incomingAll,
  intensityAt,
  nodeById,
  peakIntensity,
  waveDuration,
  weightOf,
} from '../lib/graph'
import { widthToRadius } from '../lib/geometry'
import { useSite } from '../state'

/*
  Plan view of the network in SVG. Used as:
   - the WebGL fallback for the hero (mode "wave"): each headwater pulse runs
     down every reach as a CSS-animated glowing dash, delayed by the summed
     travelTimeHours above it and fading by the same attenuation law as 3D;
   - the WebGL fallback for the attention scene (mode "attention").
*/

const PAD = 1.4
const xs = nodes.map((n) => n.pos[0])
const zs = nodes.map((n) => n.pos[2])
const minX = Math.min(...xs) - PAD
const maxX = Math.max(...xs) + PAD
const minZ = Math.min(...zs) - PAD
const maxZ = Math.max(...zs) + PAD
const W = maxX - minX
const H = maxZ - minZ
const P = (id: string) => {
  const n = nodeById.get(id)!
  return [n.pos[0] - minX, n.pos[2] - minZ] as const
}

/** Real seconds per simulated hour, matching the 3D first pass (~10 s). */
const SEC_PER_H = 10.5 / waveDuration

function reachPath(e: NetEdge) {
  const [x1, y1] = P(e.source)
  const [x2, y2] = P(e.target)
  return `M${x1.toFixed(3)} ${y1.toFixed(3)} L${x2.toFixed(3)} ${y2.toFixed(3)}`
}

function arcPath(e: NetEdge) {
  const [x1, y1] = P(e.source)
  const [x2, y2] = P(e.target)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const bend = 0.25 + e.hops * 0.35
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  return `M${x1.toFixed(3)} ${y1.toFixed(3)} Q${cx.toFixed(3)} ${cy.toFixed(3)} ${x2.toFixed(3)} ${y2.toFixed(3)}`
}

type Props =
  | { mode: 'wave'; className?: string; still?: boolean }
  | { mode: 'attention'; className?: string; onSelect: (id: string) => void }

export function NetworkPlan(props: Props) {
  const reduced = useSite((s) => s.reducedMotion)
  const aggMode = useSite((s) => s.aggMode)
  const step = useSite((s) => s.step)
  const selected = useSite((s) => s.selected)
  const routing = useMemo(() => edges.filter((e) => e.routing), [])

  const isWave = props.mode === 'wave'
  const incoming = isWave ? [] : (incomingAll.get(selected) ?? [])
  const incomingIds = new Set(incoming.map((e) => e.source))

  return (
    <svg
      viewBox={`0 0 ${W.toFixed(2)} ${H.toFixed(2)}`}
      className={props.className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter id="plan-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="0.12" />
        </filter>
      </defs>
      <style>{`
        @keyframes plan-run { from { stroke-dashoffset: 0.2; } to { stroke-dashoffset: -1.05; } }
        .plan-pulse { animation: plan-run linear both; }
      `}</style>

      {/* reaches */}
      {routing.map((e) => {
        const s = nodeById.get(e.source)!
        const dim = !isWave && selected && !incomingIds.has(e.source) && e.target !== selected
        return (
          <path
            key={e.id}
            d={reachPath(e)}
            stroke={isWave ? 'var(--w3)' : 'var(--foam-soft)'}
            strokeOpacity={isWave ? 0.9 : dim ? 0.25 : 0.55}
            strokeWidth={isWave ? widthToRadius(s.channelWidthM) * 1.6 : 0.05}
            strokeLinecap="round"
            fill="none"
          />
        )
      })}

      {/* travelling pulses, one per headwater per reach */}
      {isWave &&
        !(props.mode === 'wave' && props.still) &&
        edgeWaves.flatMap((w) =>
          w.pulses.map((p, k) => {
            const end = { ...p, variance: p.variance + w.dVar }
            const a0 = peakIntensity(p)
            const a1 = peakIntensity(end)
            const style: CSSProperties = {
              animationDuration: `${(w.edge.travelTimeHours * SEC_PER_H).toFixed(3)}s`,
              animationDelay: `${(p.arrival * SEC_PER_H).toFixed(3)}s`,
            }
            const op = Math.pow((a0 + a1) / 2, 0.72)
            if (reduced) {
              // Frozen frame: brightness at the freeze time, at mid-reach.
              const mid = p.arrival + w.edge.travelTimeHours / 2
              const s2 = p.variance + w.dVar / 2
              const d = freezeTime - mid
              const I = ((a0 + a1) / 2) * Math.exp((-d * d) / (2 * s2))
              return (
                <path
                  key={`${w.edge.id}-${k}`}
                  d={reachPath(w.edge)}
                  stroke="#f2fbfd"
                  strokeOpacity={Math.pow(Math.min(1, I), 0.72)}
                  strokeWidth={0.16}
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#plan-glow)"
                />
              )
            }
            return (
              <path
                key={`${w.edge.id}-${k}`}
                className="plan-pulse"
                d={reachPath(w.edge)}
                pathLength={1}
                stroke="#f2fbfd"
                strokeOpacity={op}
                strokeWidth={0.12 + 0.12 * op}
                strokeDasharray={`${(0.08 + 0.06 * (1 - op)).toFixed(3)} 2`}
                strokeLinecap="round"
                fill="none"
                filter="url(#plan-glow)"
                style={style}
              />
            )
          }),
        )}

      {/* message edges into the selected node */}
      {!isWave &&
        incoming.map((e) => {
          const w = weightOf(e, aggMode, step)
          const learned = aggMode === 'learned'
          return (
            <path
              key={`arc-${e.id}`}
              d={arcPath(e)}
              fill="none"
              stroke={learned ? 'var(--signal-lift)' : 'var(--foam)'}
              strokeOpacity={learned ? 0.95 : 0.7}
              strokeWidth={0.03 + w * 0.5}
              strokeLinecap="round"
            />
          )
        })}

      {/* nodes */}
      {nodes.map((n) => {
        const [x, y] = P(n.id)
        const isSel = !isWave && n.id === selected
        const glow = isWave && reduced ? Math.min(1, intensityAt(n.id, freezeTime)) : 0
        return (
          <g
            key={n.id}
            onClick={props.mode === 'attention' ? () => props.onSelect(n.id) : undefined}
            style={props.mode === 'attention' ? { cursor: 'pointer' } : undefined}
          >
            {props.mode === 'attention' && <circle cx={x} cy={y} r={0.4} fill="transparent" />}
            <circle
              cx={x}
              cy={y}
              r={n.gauged ? 0.17 : 0.11}
              fill={isSel ? 'var(--foam)' : n.gauged ? 'var(--foam)' : 'var(--foam-soft)'}
              stroke={isSel ? 'var(--abyss)' : 'none'}
              strokeWidth={0.04}
              opacity={!isWave && selected && !isSel && !incomingIds.has(n.id) ? 0.4 : 1}
            />
            {glow > 0.02 && <circle cx={x} cy={y} r={0.35} fill="#f2fbfd" opacity={glow * 0.6} filter="url(#plan-glow)" />}
            {isSel && <circle cx={x} cy={y} r={0.3} fill="none" stroke="var(--foam)" strokeWidth={0.04} />}
            {n.gauged && (
              <text
                x={x}
                y={y - 0.32}
                textAnchor="middle"
                fontSize={0.36}
                fill="var(--foam)"
                fontFamily="IBM Plex Mono, monospace"
              >
                {gaugeName.get(n.id)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
