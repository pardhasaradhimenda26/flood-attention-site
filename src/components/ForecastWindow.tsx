import { scaleLinear } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { modelWindow } from '../data/network'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'

/*
  The selected node's discharge over one model window: 24 hours the model
  sees, then the 12-hour rollout. The marker follows the rollout scrubber.
*/
export function ForecastWindow({ nodeId, step }: { nodeId: string; step: number }) {
  const [ref, width] = useMeasure<HTMLDivElement>(360)
  const data = modelWindow.series[nodeId] ?? []
  const height = 150
  const m = { t: 14, r: 10, b: 28, l: 38 }
  const n = data.length
  const origin = modelWindow.originIndex
  const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([m.l, width - m.r])
  const y = scaleLinear()
    .domain([0, Math.max(1, ...data) * 1.1])
    .range([height - m.b, m.t])
    .nice()
  const L = line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(curveMonotoneX)
  const k = origin + step + 1
  const val = data[Math.min(k, n - 1)]
  if (!n) return null
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" aria-hidden="true">
        <defs>
          <pattern id="fw-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-soft)" strokeWidth="0.7" opacity="0.35" />
          </pattern>
        </defs>
        <rect x={x(origin)} y={m.t} width={x(n - 1) - x(origin)} height={height - m.t - m.b} fill="url(#fw-hatch)" />
        {y.ticks(3).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--paper-line)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} className="num" fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        ))}
        {[-24, -12, 0, 12].map((h) => (
          <text key={h} x={x(origin + h)} y={height - 10} textAnchor="middle" fontSize={10} className="num" fill="var(--ink-soft)">
            {h === 0 ? 't' : h > 0 ? `+${h}` : `−${-h}`}
          </text>
        ))}
        <line x1={x(origin)} x2={x(origin)} y1={m.t} y2={height - m.b} stroke="var(--ink)" strokeDasharray="2 2" />
        <path d={L(data) ?? ''} fill="none" stroke="var(--w4)" strokeWidth={2} />
        <line x1={x(k)} x2={x(k)} y1={m.t} y2={height - m.b} stroke="var(--ink)" />
        <circle cx={x(k)} cy={y(val)} r={4} fill="var(--w5)" stroke="var(--paper)" strokeWidth={1.5} />
        <text x={x(origin) + 4} y={m.t + 10} fontSize={10} fill="var(--ink-soft)">
          forecast
        </text>
      </svg>
      <p className="num mt-1 text-micro text-ink-soft">
        t+{step + 1} h: {fmt(val, 2)} m³/s
      </p>
    </div>
  )
}
