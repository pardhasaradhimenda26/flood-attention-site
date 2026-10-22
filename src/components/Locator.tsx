import { useEffect, useRef } from 'react'
import { W, stormGauges } from '../lib/storm'
import { viewMarkers } from '../lib/viewMarker'

/*
  The whole reach in plan, north up, so the hero's close view always has a
  place: the river's centreline, the four gauges, a 5 km bar, and a ring on
  the ground the camera is looking at. The full version names the gauges'
  places and gives the corner coordinates. Coordinates are the dataset's
  (UTM 43N, converted to latitude and longitude); place names are
  OpenStreetMap's.
*/
const pad = 14
const xs = W.centreline.map((g) => g[0])
const ys = W.centreline.map((g) => g[1])
const box = {
  x: Math.min(...xs) - pad,
  y: Math.min(...ys) - pad,
  w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
  h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
}
const path = W.centreline.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`

export function Locator({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const ring = useRef<SVGGElement>(null)
  useEffect(() => {
    const el = ring.current
    if (!el) return
    viewMarkers.add(el)
    return () => {
      viewMarkers.delete(el)
    }
  }, [])
  if (!W.centreline.length) return null
  const fiveKm = 5000 / W.cellM
  // One CSS pixel at the map's drawn width, in grid units.
  const u = box.w / (compact ? 112 : 220)
  const { nw, se } = W.corners
  return (
    <figure className={`pointer-events-none border-hair border-abyss-line bg-abyss p-1.5 ${className}`} aria-hidden="true">
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block h-auto w-full">
        <path d={path} fill="none" stroke="var(--silt-1)" strokeWidth={u * 2.2} strokeLinejoin="round" strokeLinecap="round" />
        <g ref={ring}>
          <circle r={1} fill="none" stroke="var(--foam)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.85} />
        </g>
        {stormGauges.map((g, i) => (
          <g key={g.id} transform={`translate(${g.section.grid[0]} ${g.section.grid[1]})`}>
            <circle r={u * 3} fill="var(--foam)" />
            <text
              x={i === stormGauges.length - 1 ? -u * 5 : u * 5}
              y={i % 2 ? u * 12 : -u * 6}
              textAnchor={i === stormGauges.length - 1 ? 'end' : 'start'}
              fontSize={u * 9}
              fill="var(--foam)"
            >
              {g.name}
            </text>
          </g>
        ))}
        {/* north arrow: grid north is within 0.3° of true north here */}
        <g transform={`translate(${box.x + u * 10} ${box.y + u * 26})`}>
          <path d={`M0 ${-u * 14} L${u * 4} 0 L0 ${-u * 4} L${-u * 4} 0 Z`} fill="var(--foam)" />
          <text y={u * 10} fontSize={u * 9} textAnchor="middle" fill="var(--foam-soft)">
            N
          </text>
        </g>
        <g transform={`translate(${box.x + box.w - fiveKm - u * 8} ${box.y + box.h - u * 8})`}>
          <path d={`M0 0 H${fiveKm}`} stroke="var(--foam-soft)" strokeWidth={u * 1.2} />
          <path d={`M0 ${-u * 3} V0 M${fiveKm} ${-u * 3} V0`} stroke="var(--foam-soft)" strokeWidth={u} />
          <text x={fiveKm / 2} y={-u * 5} fontSize={u * 8} textAnchor="middle" fill="var(--foam-soft)">
            5 km
          </text>
        </g>
      </svg>
      {!compact && (
        <figcaption className="mt-1 text-micro leading-tight text-foam-soft">
          <span className="block">
            {stormGauges.map((g, i) => (
              <span key={g.id}>
                {i ? ', ' : ''}
                <span className="num text-foam">{g.name}</span> {g.place}
              </span>
            ))}
          </span>
          <span className="num mt-0.5 block">
            {deg(se[0], 'N', 'S')} to {deg(nw[0], 'N', 'S')}, {deg(nw[1], 'E', 'W')} to {deg(se[1], 'E', 'W')}
          </span>
          <span className="block">Places © OpenStreetMap contributors. Imagery: Sentinel-2 cloudless 2016, EOX, CC BY 4.0</span>
        </figcaption>
      )}
    </figure>
  )
}
