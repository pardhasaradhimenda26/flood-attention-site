import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { stormEvent } from '../data/storm'
import { hero } from '../data/content'
import { useSite } from '../state'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'
import {
  depthAt,
  holdHour,
  lagHours,
  lastHour,
  outletId,
  outletPeakHour,
  rainPeakHour,
  stormGauges,
  stormHours,
  trendAt,
  upstreamRain,
} from '../lib/storm'

/*
  The storm, plotted the way a hydrologist plots an event: rainfall on the
  headwaters as bars hanging from the top, the four gauges' water depth below,
  hours along the bottom. The rain peak and the outlet's peak are marked and
  the gap between them is dimensioned, so the lag can be read off the chart.
  The vertical line is now; drag it, tap anywhere, or use the arrow keys on the
  slider beneath. Gauges are told apart by dash and direct label, not colour.
*/

const DASH = ['', '6 3', '2 3', '10 3 2 3']

export function StormTimeline({ drive = false }: { drive?: boolean }) {
  // Start from the window's width so the first paint already picks the right layout.
  const [ref, width] = useMeasure<HTMLDivElement>(typeof window === 'undefined' ? 900 : Math.min(1400, window.innerWidth - 32))
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
      const next = Math.min(lastHour, st.heroTime + ((now - prev) / 1000) * 10)
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
    const h = Math.round(t)
    const out = stormGauges.find((g) => g.id === outletId)
    setSaid(
      `Hour ${h} of ${lastHour}. Rain on the headwaters ${fmt(upstreamRain[h] ?? 0, 1)} millimetres. ` +
        `Outlet gauge ${out?.name ?? ''}: ${fmt(depthAt(outletId, t), 2)} metres, ${trendAt(outletId, t)}.`,
    )
  }, [t])

  if (!stormEvent) return null
  const ev = stormEvent

  const narrow = width < 560
  const m = { l: narrow ? 8 : 40, r: narrow ? 8 : 112, t: 22, b: 30 }
  const H = narrow ? 168 : 156
  const rainH = 34
  const x = scaleLinear().domain([0, lastHour]).range([m.l, width - m.r])
  const maxR = Math.max(...upstreamRain, 0.1)
  const rY = scaleLinear().domain([0, maxR]).range([m.t, m.t + rainH])
  const maxD = Math.max(...stormGauges.flatMap((g) => ev.nodes[g.id].depthM))
  const dY = scaleLinear().domain([0, maxD * 1.08]).range([H - m.b, m.t + rainH + 22])
  const hours = Array.from({ length: stormHours }, (_, i) => i)
  const bw = Math.max(1, (x(1) - x(0)) * 0.8)

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

  const dimY = m.t + rainH + 10
  const gaugeEnds = stormGauges
    .map((g, i) => ({ g, i, y: dY(ev.nodes[g.id].depthM[lastHour]) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < gaugeEnds.length; k++) if (gaugeEnds[k].y - gaugeEnds[k - 1].y < 12) gaugeEnds[k].y = gaugeEnds[k - 1].y + 12

  return (
    <div ref={ref} className="min-w-0 select-none">
      <svg width={width} height={H} className="block" aria-hidden="true">
        {/* hairline graticule every 24 h */}
        {hours
          .filter((h) => h % 24 === 0)
          .map((h) => (
            <g key={h}>
              <line x1={x(h)} x2={x(h)} y1={m.t} y2={H - m.b} stroke="var(--abyss-line)" />
              <text x={x(h)} y={H - m.b + 16} textAnchor="middle" className="num" fontSize={11} fill="var(--foam-soft)">
                {h}
              </text>
            </g>
          ))}
        <text x={width - m.r} y={H - 4} textAnchor="end" fontSize={11} fill="var(--foam-soft)">
          hours since the start of the record shown
        </text>
        <line x1={m.l} x2={width - m.r} y1={m.t} y2={m.t} stroke="var(--foam-soft)" />
        <line x1={m.l} x2={width - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--foam-soft)" />

        {/* hyetograph: rain on the headwaters, hanging from the top */}
        {hours.map((h) =>
          upstreamRain[h] > 0.05 ? (
            <rect key={h} x={x(h) - bw / 2} y={m.t} width={bw} height={rY(upstreamRain[h]) - m.t} fill="var(--foam-soft)" opacity={h <= t ? 0.95 : 0.4} />
          ) : null,
        )}
        {!narrow && (
          <text x={width - m.r + 8} y={m.t + 10} fontSize={11} fill="var(--foam-soft)">
            rain, headwaters
          </text>
        )}

        {/* the lag, dimensioned */}
        <line x1={x(rainPeakHour)} x2={x(rainPeakHour)} y1={m.t} y2={H - m.b} stroke="var(--foam)" strokeDasharray="1 3" />
        <line x1={x(outletPeakHour)} x2={x(outletPeakHour)} y1={m.t} y2={H - m.b} stroke="var(--foam)" strokeDasharray="1 3" />
        <line x1={x(rainPeakHour)} x2={x(outletPeakHour)} y1={dimY} y2={dimY} stroke="var(--foam)" />
        <path d={`M${x(rainPeakHour) + 5} ${dimY - 3} L${x(rainPeakHour)} ${dimY} L${x(rainPeakHour) + 5} ${dimY + 3}`} fill="none" stroke="var(--foam)" />
        <path d={`M${x(outletPeakHour) - 5} ${dimY - 3} L${x(outletPeakHour)} ${dimY} L${x(outletPeakHour) - 5} ${dimY + 3}`} fill="none" stroke="var(--foam)" />
        <text x={(x(rainPeakHour) + x(outletPeakHour)) / 2} y={dimY - 5} textAnchor="middle" fontSize={11} fill="var(--foam)">
          <tspan className="num">{lagHours} h</tspan> from rain peak to outlet peak
        </text>
        <text x={x(rainPeakHour) + 3} y={m.t - 6} fontSize={11} fill="var(--foam)">
          rain peak <tspan className="num">h{rainPeakHour}</tspan>
        </text>
        <text x={x(outletPeakHour) - 3} y={m.t - 6} textAnchor="end" fontSize={11} fill="var(--foam)">
          outlet peak <tspan className="num">h{outletPeakHour}</tspan>
        </text>

        {/* water depth at the four gauges */}
        {stormGauges.map((g, i) => {
          const d = ev.nodes[g.id].depthM
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
          <span>bars: rain, headwaters</span>
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
          aria-valuetext={`hour ${Math.round(t)}: outlet ${fmt(depthAt(outletId, t), 2)} metres, ${trendAt(outletId, t)}`}
          onChange={(e) => {
            touched.current = true
            seek(Number(e.target.value))
          }}
        />
        <output className="num w-16 text-small text-foam">h{Math.round(t)}</output>
        {settled && !reduced ? (
          <button type="button" onClick={replay} className="text-small text-foam underline decoration-foam-soft underline-offset-4 hover:decoration-foam">
            {hero.replay}
          </button>
        ) : null}
      </div>
      {reduced && <p className="mt-1 text-micro text-foam-soft">{hero.frozen}</p>}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  )
}
