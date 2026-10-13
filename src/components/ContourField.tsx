import { useEffect, useRef, useState } from 'react'
import { nodeById } from '../lib/graph'
import { terrainBounds, terrainHeight, yToMetres } from '../lib/terrain'
import type { SectionKey } from '../lib/stations'
import { stationOf } from '../lib/stations'

/*
  The chart-paper ground is printed with the same valley the hero renders in
  3D: isolines of terrainHeight every 0.12 world units (index line every 5th),
  traced by marching squares, plus spot soundings in metres. Each section
  shows the patch of ground around its own station.
*/

const NX = 150
const STEP = 0.12

type Field = { index: string; minor: string; soundings: { x: number; y: number; m: number }[] }

let cached: Field | null = null
let pending: Promise<Field> | null = null

/** Trace once, off the critical path, and share the result between sections. */
function traceWhenIdle(): Promise<Field> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = new Promise((resolve) => {
      const run = () => resolve(trace())
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
      if (ric) ric(run, { timeout: 2500 })
      else window.setTimeout(run, 200)
    })
  }
  return pending
}

function trace(): Field {
  if (cached) return cached
  const { minX, maxX, minZ, maxZ } = terrainBounds
  const w = maxX - minX
  const h = maxZ - minZ
  const NZ = Math.round((NX * h) / w)
  const dx = w / NX
  const dz = h / NZ
  const H: number[] = new Array((NX + 1) * (NZ + 1))
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j <= NZ; j++)
    for (let i = 0; i <= NX; i++) {
      const v = terrainHeight(minX + i * dx, minZ + j * dz)
      H[j * (NX + 1) + i] = v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  const at = (i: number, j: number) => H[j * (NX + 1) + i]
  let index = ''
  let minor = ''
  const f = (n: number) => n.toFixed(2)
  const first = Math.ceil(lo / STEP)
  const last = Math.floor(hi / STEP)
  for (let k = first; k <= last; k++) {
    const lv = k * STEP
    let d = ''
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        const a = at(i, j)
        const b = at(i + 1, j)
        const c = at(i + 1, j + 1)
        const e = at(i, j + 1)
        const code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (e > lv ? 1 : 0)
        if (code === 0 || code === 15) continue
        const x0 = i * dx
        const z0 = j * dz
        const top = () => [x0 + ((lv - a) / (b - a)) * dx, z0] as const
        const right = () => [x0 + dx, z0 + ((lv - b) / (c - b)) * dz] as const
        const bottom = () => [x0 + ((lv - e) / (c - e)) * dx, z0 + dz] as const
        const left = () => [x0, z0 + ((lv - a) / (e - a)) * dz] as const
        const seg = (p: readonly [number, number], q: readonly [number, number]) => {
          d += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`
        }
        switch (code) {
          case 1: case 14: seg(left(), bottom()); break
          case 2: case 13: seg(bottom(), right()); break
          case 3: case 12: seg(left(), right()); break
          case 4: case 11: seg(top(), right()); break
          case 6: case 9: seg(top(), bottom()); break
          case 7: case 8: seg(left(), top()); break
          case 5: seg(left(), top()); seg(bottom(), right()); break
          case 10: seg(left(), bottom()); seg(top(), right()); break
        }
      }
    if (k % 5 === 0) index += d
    else minor += d
  }
  // Soundings on a jittered lattice, deterministic.
  const soundings: Field['soundings'] = []
  for (let j = 1; j < 9; j++)
    for (let i = 1; i < 16; i++) {
      const jx = ((i * 7919 + j * 104729) % 97) / 97 - 0.5
      const jz = ((i * 15485863 + j * 32452843) % 89) / 89 - 0.5
      const x = (i + jx * 0.7) * (w / 16)
      const z = (j + jz * 0.7) * (h / 9)
      soundings.push({ x, y: z, m: yToMetres(terrainHeight(minX + x, minZ + z)) })
    }
  cached = { index, minor, soundings }
  return cached
}

type Props = { section: SectionKey; className?: string; tone?: 'paper' | 'abyss' }

/** Pixels per world unit: fixed, so line weight and sounding size never depend on section height. */
const PX = 118

export function ContourField({ section, className = '', tone = 'paper' }: Props) {
  const [field, setField] = useState<Field | null>(cached)
  useEffect(() => {
    if (!field) traceWhenIdle().then(setField)
  }, [field])
  const ref = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 900 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width || 1200, h: e.contentRect.height || 900 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { minX, minZ } = terrainBounds
  const node = nodeById.get(stationOf(section).nodeId)!
  // A window centred on the station.
  const vw = box.w / PX
  const vh = box.h / PX
  const cx = node.pos[0] - minX
  const cz = node.pos[2] - minZ
  const line = tone === 'paper' ? 'var(--graticule)' : 'var(--abyss-line)'
  const text = tone === 'paper' ? 'var(--ink-soft)' : 'var(--foam-soft)'
  return (
    <svg
      ref={ref}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox={`${(cx - vw / 2).toFixed(2)} ${(cz - vh / 2).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {field && (
        <>
      <path d={field.minor} stroke={line} strokeWidth="0.6" vectorEffect="non-scaling-stroke" fill="none" opacity="0.45" />
      <path d={field.index} stroke={line} strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" opacity="0.6" />
      <g fill={text} opacity="0.45" fontFamily="IBM Plex Mono, monospace" fontSize={(10 / PX).toFixed(4)}>
        {field.soundings.map((s, i) => (
          <text key={i} x={s.x} y={s.y} textAnchor="middle">
            {Math.round(s.m)}
          </text>
        ))}
      </g>
        </>
      )}
    </svg>
  )
}
