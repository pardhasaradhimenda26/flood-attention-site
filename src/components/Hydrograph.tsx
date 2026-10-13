import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import { problemHydrograph as H } from '../data/network'
import { hydroStats } from '../lib/hydro'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'

/*
  The same storm at two gauges on the main stem, plus the headwater record
  routed alone with the dataset's own Muskingum K and X. Scrub with the
  pointer or the arrow keys to read all three at one hour.
*/

export function Hydrograph() {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const st = useMemo(hydroStats, [])
  const [cursor, setCursor] = useState<number | null>(null)
  const height = Math.max(260, Math.min(380, width * 0.5))
  const m = { t: 40, r: 18, b: 40, l: 46 }
  const n = H.hours.length
  const x = scaleLinear().domain([0, n - 1]).range([m.l, width - m.r])
  const ymax = Math.max(...H.recordedDownstream, ...H.recordedUpstream) * 1.12
  const y = scaleLinear().domain([0, ymax]).range([height - m.b, m.t]).nice()
  const L = line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(curveMonotoneX)
  const A = area<number>().x((_, i) => x(i)).y0(y(0)).y1((d) => y(d)).curve(curveMonotoneX)

  const rel = (i: number) => i - st.iu
  const xticks = Array.from({ length: Math.floor(n / 12) + 1 }, (_, k) => k * 12).filter((i) => i < n)
  const series = [
    { key: 'up', label: `${st.up} recorded, headwater`, data: H.recordedUpstream, peak: st.iu },
    { key: 'down', label: `${st.down} recorded, mid-basin`, data: H.recordedDownstream, peak: st.id },
    { key: 'routed', label: `${st.up} routed alone to ${st.down}`, data: H.routedUpstreamOnly, peak: st.ir },
  ]

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const i = Math.round(x.invert(e.clientX - r.left + m.l))
    setCursor(Math.max(0, Math.min(n - 1, i)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    setCursor((c) => {
      const cur = c ?? st.iu
      if (e.key === 'Home') return 0
      if (e.key === 'End') return n - 1
      const step = e.shiftKey ? 6 : 1
      return Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? step : -step)))
    })
  }

  const Marker = ({ k, cx, cy }: { k: string; cx: number; cy: number }) =>
    k === 'up' ? (
      <circle cx={cx} cy={cy} r={4.5} fill="var(--w5)" stroke="var(--paper)" strokeWidth={1.5} />
    ) : k === 'down' ? (
      <rect x={cx - 4.5} y={cy - 4.5} width={9} height={9} fill="var(--w4)" stroke="var(--paper)" strokeWidth={1.5} />
    ) : (
      <path d={`M${cx} ${cy - 5.5} L${cx + 5} ${cy + 3.5} L${cx - 5} ${cy + 3.5} Z`} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={1.5} />
    )

  const lagY = m.t - 22
  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`Hydrograph. ${st.up} peaks at ${fmt(H.recordedUpstream[st.iu], 1)} cubic metres per second. ${st.down} peaks ${st.lagRecorded} hours later at ${fmt(H.recordedDownstream[st.id], 1)}. Routed alone, the headwater wave peaks ${st.lagRouted} hours later at ${st.pctRouted} percent of its height above base flow. Use left and right arrow keys to read values.`}
        className="block overflow-visible"
      >
        {/* graticule */}
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--paper-line)" strokeWidth={1} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        ))}
        <text x={m.l - 8} y={m.t - 6} textAnchor="end" fontSize={11} fill="var(--ink-soft)">m³/s</text>
        {xticks.map((i) => (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={height - m.b} y2={height - m.b + 5} stroke="var(--ink-soft)" />
            <text x={x(i)} y={height - m.b + 18} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
              {rel(i) >= 0 ? `+${rel(i)}` : `−${-rel(i)}`}
            </text>
          </g>
        ))}
        <text x={width - m.r} y={height - 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)">
          hours after the headwater peak
        </text>

        {/* fills on the water ramp, then lines */}
        <path d={A(H.recordedDownstream) ?? ''} fill="var(--w1)" opacity={0.55} />
        <path d={A(H.recordedUpstream) ?? ''} fill="var(--w2)" opacity={0.45} />
        <path d={L(H.recordedDownstream) ?? ''} fill="none" stroke="var(--w4)" strokeWidth={2.5} />
        <path d={L(H.recordedUpstream) ?? ''} fill="none" stroke="var(--w5)" strokeWidth={2} />
        <path d={L(H.routedUpstreamOnly) ?? ''} fill="none" stroke="var(--ink-soft)" strokeWidth={1.75} strokeDasharray="6 4" />

        {/* lag dimensions */}
        {[
          { a: st.iu, b: st.id, label: `${st.lagRecorded} h to ${st.down} peak`, dy: 0 },
          { a: st.iu, b: st.ir, label: `${st.lagRouted} h routed alone`, dy: 15 },
        ].map((d) => (
          <g key={d.label} fontSize={11} fill="var(--ink)">
            <line x1={x(d.a)} x2={x(d.b)} y1={lagY + d.dy} y2={lagY + d.dy} stroke="var(--ink)" />
            <line x1={x(d.a)} x2={x(d.a)} y1={lagY + d.dy - 4} y2={lagY + d.dy + 4} stroke="var(--ink)" />
            <line x1={x(d.b)} x2={x(d.b)} y1={lagY + d.dy - 4} y2={lagY + d.dy + 4} stroke="var(--ink)" />
            <text x={x(d.b) + 6} y={lagY + d.dy} dy="0.32em" className="num">
              {d.label}
            </text>
          </g>
        ))}

        {/* peaks with shapes and direct labels */}
        {series.map((s) => (
          <g key={s.key}>
            <line x1={x(s.peak)} x2={x(s.peak)} y1={y(s.data[s.peak])} y2={lagY + 22} stroke="var(--ink-soft)" strokeDasharray="1 3" />
            <Marker k={s.key} cx={x(s.peak)} cy={y(s.data[s.peak])} />
          </g>
        ))}

        {/* scrub cursor */}
        {cursor !== null && (
          <g pointerEvents="none">
            <line x1={x(cursor)} x2={x(cursor)} y1={m.t} y2={height - m.b} stroke="var(--ink)" />
            {series.map((s) => (
              <Marker key={s.key} k={s.key} cx={x(cursor)} cy={y(s.data[cursor])} />
            ))}
          </g>
        )}
        <rect
          x={m.l}
          y={m.t}
          width={Math.max(0, width - m.l - m.r)}
          height={Math.max(0, height - m.t - m.b)}
          fill="transparent"
          style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setCursor(null)}
        />
      </svg>

      {/* legend doubles as the scrub readout */}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-small sm:grid-cols-3" aria-live="polite">
        {series.map((s) => (
          <div key={s.key} className="flex items-baseline gap-2">
            <dt className="flex items-baseline gap-2 text-ink-soft">
              <svg width="18" height="10" aria-hidden="true" className="shrink-0 translate-y-px">
                {s.key === 'routed' ? (
                  <line x1="0" x2="18" y1="5" y2="5" stroke="var(--ink-soft)" strokeWidth="1.75" strokeDasharray="5 3" />
                ) : (
                  <line x1="0" x2="18" y1="5" y2="5" stroke={s.key === 'up' ? 'var(--w5)' : 'var(--w4)'} strokeWidth="2.5" />
                )}
              </svg>
              {s.label}
            </dt>
            <dd className="num ml-auto text-ink sm:ml-0">
              {fmt(s.data[cursor ?? s.peak], 2)}
              <span className="text-ink-soft">{cursor === null ? ' peak' : ` at ${rel(cursor) >= 0 ? '+' : '−'}${Math.abs(rel(cursor))} h`}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
