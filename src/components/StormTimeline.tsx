import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { hero, tpl } from '../data/content'
import { useSite } from '../state'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'
import {
  FLOW_SPEEDUP,
  dateAt,
  depthAt,
  holdHour,
  inflow,
  inflowAt,
  inflowPeakHour,
  lagHours,
  lastHour,
  outletId,
  outletPeakHour,
  stormGauges,
  stormHours,
  trendAt,
} from '../lib/storm'

/*
  The flood, plotted the way a hydrologist plots an event: the inflow arriving
  from upstream at Mananthavady across the top, each gauge's water level below
  (its rise above where it stood at the start of the window, so all four share
  one axis), dates along the bottom. The inflow peak and the outlet's peak are
  marked and the gap between them is dimensioned, so the lag can be read off
  the chart. The vertical line is now; drag it, tap anywhere, or use the arrow
  keys on the slider beneath. Gauges are told apart by dash and direct label.
*/

const DASH = ['', '6 3', '2 3', '10 3 2 3']

export function StormTimeline({ drive = false }: { drive?: boolean }) {
  // Start from the window's width so the first paint already picks the right layout.
  const [ref, width] = useMeasure<HTMLDivElement>(typeof window === 'undefined' ? 900 : Math.max(288, Math.min(1400, window.innerWidth - 32)))
  const t = useSite((s) => s.heroTime)
  const playing = useSite((s) => s.heroPlaying)
  const settled = useSite((s) => s.heroSettled)
  const reduced = useSite((s) => s.reducedMotion)
  const seek = useSite((s) => s.seekHero)
  const replay = useSite((s) => s.replayHero)
  const [said, setSaid] = useState('')
  const touched = useRef(false)
  const lastSaid = useRef(0)

  // Reduced motion holds the storm where the river carries the most water.
  useEffect(() => {
    if (reduced) useSite.getState().setHeroTime(holdHour)
  }, [reduced])

  // Without WebGL there is no scene to own the clock; run it here.
  useEffect(() => {
    if (!drive || !playing || reduced) return
    let raf = 0
    let prev = performance.now()
    const step = (now: number) => {
      const st = useSite.getState()
      const next = Math.min(lastHour, st.heroTime + ((now - prev) / 1000) * 12)
      prev = now
      st.setHeroTime(next)
      if (next >= lastHour) st.setHeroSettled(true)
      else raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [drive, playing, reduced])

  // Announce what changed when the reader moves the storm; stay quiet during autoplay.
  useEffect(() => {
    if (!touched.current) return
    const now = performance.now()
    if (now - lastSaid.current < 500) return
    lastSaid.current = now
    const out = stormGauges.find((g) => g.id === outletId)
    setSaid(
      `${dateAt(t)}. Inflow from upstream ${fmt(inflowAt(t), 0)} cubic metres per second. ` +
        `Outlet gauge ${out?.name ?? ''}: ${fmt(depthAt(outletId, t), 2)} metres deep, ${trendAt(outletId, t)}.`,
    )
  }, [t])

  if (!stormGauges.length) return null

  const narrow = width < 560
  const m = { l: narrow ? 8 : 40, r: narrow ? 8 : 112, t: 22, b: 30 }
  const H = narrow ? 172 : 160
  const inH = 34
  const x = scaleLinear().domain([0, lastHour]).range([m.l, width - m.r])
  const maxQ = Math.max(...inflow, 1)
  const qY = scaleLinear().domain([0, maxQ]).range([m.t + inH, m.t])
  const rise = (id: string) => {
    const d = stormGauges.find((g) => g.id === id)!.section.depth_m ?? []
    return d.map((v) => v - d[0])
  }
  const maxD = Math.max(0.1, ...stormGauges.flatMap((g) => rise(g.id)))
  const dY = scaleLinear().domain([0, maxD * 1.08]).range([H - m.b, m.t + inH + 22])
  const hours = Array.from({ length: stormHours }, (_, i) => i)

  const toHour = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(lastHour, x.invert(clientX - r.left)))
  }
  const onDown = (e: PointerEvent<SVGRectElement>) => {
    touched.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seek(toHour(e.clientX, e.currentTarget.ownerSVGElement!))
  }
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    seek(toHour(e.clientX, e.currentTarget.ownerSVGElement!))
  }

  const dimY = m.t + inH + 10
  const gaugeEnds = stormGauges
    .map((g, i) => ({ g, i, y: dY(Math.max(...rise(g.id))) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < gaugeEnds.length; k++) if (gaugeEnds[k].y - gaugeEnds[k - 1].y < 12) gaugeEnds[k].y = gaugeEnds[k - 1].y + 12

  return (
    <div ref={ref} className="min-w-0 select-none">
      <svg width={width} height={H} className="block" aria-hidden="true">
        {/* hairline graticule at each midnight */}
        {hours
          .filter((h) => dateAt(h).endsWith('00:00'))
          .map((h) => (
            <g key={h}>
              <line x1={x(h)} x2={x(h)} y1={m.t} y2={H - m.b} stroke="var(--abyss-line)" />
              <text x={x(h)} y={H - m.b + 16} textAnchor="middle" fontSize={11} fill="var(--foam-soft)">
                {dateAt(h).split(',')[0]}
              </text>
            </g>
          ))}
        <text x={width - m.r} y={H - 4} textAnchor="end" fontSize={11} fill="var(--foam-soft)">
          August 2018, model time
        </text>
        <line x1={m.l} x2={width - m.r} y1={m.t} y2={m.t} stroke="var(--foam-soft)" />
        <line x1={m.l} x2={width - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--foam-soft)" />

        {/* the inflow arriving from upstream: the only water in this model */}
        <path
          d={`M${x(0)} ${m.t + inH} ` + hours.map((h) => `L${x(h)} ${qY(inflow[h])}`).join(' ') + ` L${x(lastHour)} ${m.t + inH} Z`}
          fill="var(--foam-soft)"
          opacity={0.45}
        />
        <path d={hours.map((h, i) => `${i ? 'L' : 'M'}${x(h)} ${qY(inflow[h])}`).join(' ')} fill="none" stroke="var(--foam-soft)" />
        {!narrow && (
          <text x={width - m.r + 8} y={m.t + 10} fontSize={11} fill="var(--foam-soft)">
            inflow, m³/s
          </text>
        )}

        {/* the lag, dimensioned */}
        <line x1={x(inflowPeakHour)} x2={x(inflowPeakHour)} y1={m.t} y2={H - m.b} stroke="var(--foam)" strokeDasharray="1 3" />
        <line x1={x(outletPeakHour)} x2={x(outletPeakHour)} y1={m.t} y2={H - m.b} stroke="var(--foam)" strokeDasharray="1 3" />
        <line x1={x(inflowPeakHour)} x2={x(outletPeakHour)} y1={dimY} y2={dimY} stroke="var(--foam)" />
        <path d={`M${x(inflowPeakHour) + 5} ${dimY - 3} L${x(inflowPeakHour)} ${dimY} L${x(inflowPeakHour) + 5} ${dimY + 3}`} fill="none" stroke="var(--foam)" />
        <path d={`M${x(outletPeakHour) - 5} ${dimY - 3} L${x(outletPeakHour)} ${dimY} L${x(outletPeakHour) - 5} ${dimY + 3}`} fill="none" stroke="var(--foam)" />
        <text x={(x(inflowPeakHour) + x(outletPeakHour)) / 2} y={dimY - 5} textAnchor="middle" fontSize={11} fill="var(--foam)">
          <tspan className="num">{lagHours} h</tspan> from inflow peak to outlet peak
        </text>
        <text x={x(inflowPeakHour) - 3} y={m.t - 6} textAnchor="end" fontSize={11} fill="var(--foam)">
          inflow peak <tspan className="num">{dateAt(inflowPeakHour)}</tspan>
        </text>
        <text x={x(outletPeakHour) + 3} y={m.t - 6} fontSize={11} fill="var(--foam)">
          outlet peak <tspan className="num">{dateAt(outletPeakHour)}</tspan>
        </text>

        {/* each gauge's rise in water level */}
        {stormGauges.map((g, i) => {
          const d = rise(g.id)
          const path = line<number>()
            .x((_, k) => x(k))
            .y((v) => dY(v))(d)
          return <path key={g.id} d={path ?? ''} fill="none" stroke="var(--foam)" strokeWidth={i === stormGauges.length - 1 ? 2 : 1.25} strokeDasharray={DASH[i]} opacity={0.9} />
        })}
        {!narrow &&
          gaugeEnds.map(({ g, y }) => (
            <text key={g.id} x={width - m.r + 8} y={y} dy="0.32em" fontSize={11} fill="var(--foam)">
              <tspan className="num">{g.name}</tspan> <tspan fill="var(--foam-soft)">{g.role}</tspan>
            </text>
          ))}

        {/* now */}
        <line x1={x(t)} x2={x(t)} y1={m.t - 2} y2={H - m.b + 2} stroke="var(--foam)" strokeWidth={2} />
        <rect x={x(t) - 4} y={H - m.b - 4} width={8} height={8} fill="var(--foam)" />

        <rect
          x={m.l}
          y={0}
          width={Math.max(0, width - m.l - m.r)}
          height={H}
          fill="transparent"
          style={{ cursor: 'ew-resize', touchAction: 'pan-y' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
        />
      </svg>

      {narrow && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-micro text-foam-soft">
          {stormGauges.map((g, i) => (
            <span key={g.id} className="inline-flex items-center gap-1">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" x2="18" y1="3" y2="3" stroke="var(--foam)" strokeWidth={i === stormGauges.length - 1 ? 2 : 1.25} strokeDasharray={DASH[i]} />
              </svg>
              <span className="num text-foam">{g.name}</span> {g.role}
            </span>
          ))}
          <span>shaded: inflow from upstream</span>
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ paddingLeft: m.l, paddingRight: narrow ? m.r : m.r }}>
        <input
          type="range"
          className="range min-w-0 flex-1"
          min={0}
          max={lastHour}
          step={1}
          value={Math.round(t)}
          aria-label={hero.timelineLabel}
          aria-valuetext={`${dateAt(t)}: outlet ${fmt(depthAt(outletId, t), 2)} metres deep, ${trendAt(outletId, t)}`}
          onChange={(e) => {
            touched.current = true
            seek(Number(e.target.value))
          }}
        />
        <output className="num w-28 text-small text-foam">{dateAt(t)}</output>
        {settled && !reduced ? (
          <button type="button" onClick={replay} className="text-small text-foam underline decoration-foam-soft underline-offset-4 hover:decoration-foam">
            {hero.replay}
          </button>
        ) : null}
      </div>
      {reduced && <p className="mt-1 text-micro text-foam-soft">{hero.frozen}</p>}
      <p className="mt-2 max-w-measure text-micro text-foam-soft">{tpl(hero.scaleNote, { speedup: FLOW_SPEEDUP })}</p>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  )
}
