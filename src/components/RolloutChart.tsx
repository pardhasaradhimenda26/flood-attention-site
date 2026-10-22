import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { scaleLinear, scaleLog } from 'd3-scale'
import { line } from 'd3-shape'
import { rollout, type ModelKey, type RolloutSeries } from '../data/results'

/** A series may carry MAE and a 95% interval per step (the Wayanad run does). */
type Series = RolloutSeries & { mae?: number[]; lo?: number[]; hi?: number[] }
type RolloutData = { unit: string; steps: number[]; panels: { gauged: Series[]; ungauged: Series[] } }
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'
import { logTicks, spreadLabels } from '../lib/chart'

/*
  Error against rollout step, one line per model, gauged and ungauged nodes in
  separate panels. Models are told apart by dash, marker shape and a direct
  label — never by colour alone. A pending series is listed, hatched, and not
  drawn.
*/

const STYLE: Record<ModelKey, { label: string; dash?: string; width: number; stroke: string; shape: 'circle' | 'tri' | 'square' | 'dot' }> = {
  persistence: { label: 'Persistence', dash: '1.5 3.5', width: 1.5, stroke: 'var(--ink-soft)', shape: 'circle' },
  mlp: { label: 'MLP (graph-blind)', dash: '6 4', width: 1.5, stroke: 'var(--ink-soft)', shape: 'tri' },
  gcn: { label: 'GCN', width: 1.5, stroke: 'var(--ink)', shape: 'square' },
  gat: { label: 'GAT', width: 3, stroke: 'var(--ink)', shape: 'dot' },
}

function Mark({ shape, cx, cy }: { shape: string; cx: number; cy: number }) {
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={3.5} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={1.4} />
  if (shape === 'tri') return <path d={`M${cx} ${cy - 4.5} L${cx + 4} ${cy + 3} L${cx - 4} ${cy + 3} Z`} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={1.4} />
  if (shape === 'square') return <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
  return <circle cx={cx} cy={cy} r={4.5} fill="var(--ink)" />
}

function Panel({ title, series, steps, cursor, setCursor }: { title: string; series: Series[]; steps: number[]; cursor: number | null; setCursor: (c: number | null) => void }) {
  const [ref, width] = useMeasure<HTMLDivElement>(420)
  const height = 300
  const m = { t: 16, r: 92, b: 36, l: 44 }
  const drawn = series.filter((s) => s.status === 'verified' && s.values.length)
  const all = drawn.flatMap((s) => [...s.values, ...(s.lo ?? []), ...(s.hi ?? [])]).filter((v) => v > 0)
  const x = scaleLinear().domain([steps[0], steps[steps.length - 1]]).range([m.l, width - m.r])
  const y = scaleLog()
    .domain([Math.min(...all) * 0.85, Math.max(...all) * 1.15])
    .range([height - m.b, m.t])
  const L = line<number>().x((_, i) => x(steps[i])).y((d) => y(d))
  const ticks = logTicks(y.domain()[0], y.domain()[1])

  // Spread end labels so they do not overlap.
  const ends = spreadLabels(drawn.map((s) => ({ item: s, y: y(s.values[s.values.length - 1]) }))).map(({ item, y }) => ({ s: item, y }))

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const v = Math.round(x.invert(e.clientX - r.left + m.l))
    setCursor(Math.max(steps[0], Math.min(steps[steps.length - 1], v)))
  }

  return (
    <div ref={ref}>
      <h3 className="mb-2 text-small font-semibold text-ink">{title}</h3>
      <svg width={width} height={height} className="block" aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--paper-line)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        ))}
        {steps.filter((s) => steps.length <= 6 || s === 1 || s % 3 === 0).map((s) => (
          <text key={s} x={x(s)} y={height - 16} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
            +{s}
          </text>
        ))}
        <text x={width - m.r} y={height - 2} textAnchor="end" fontSize={11} fill="var(--ink-soft)">forecast hour</text>
        {/* 95% intervals for the two graph models, as hatched bands behind the lines */}
        <defs>
          <pattern id={`band-${title.replace(/\W/g, '')}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-soft)" strokeWidth="0.8" opacity="0.45" />
          </pattern>
        </defs>
        {drawn
          .filter((s) => s.lo && s.hi && (s.model === 'gat' || s.model === 'gcn'))
          .map((s) => {
            const up = s.hi!.map((v, i) => `${i ? 'L' : 'M'}${x(steps[i])} ${y(Math.max(v, y.domain()[0]))}`).join(' ')
            const down = s.lo!
              .map((v, i) => [i, v] as const)
              .reverse()
              .map(([i, v]) => `L${x(steps[i])} ${y(Math.max(v, y.domain()[0]))}`)
              .join(' ')
            return (
              <path
                key={`band-${s.model}`}
                d={`${up} ${down} Z`}
                fill={`url(#band-${title.replace(/\W/g, '')})`}
                stroke="var(--ink-soft)"
                strokeWidth={0.6}
                strokeDasharray={s.model === 'gcn' ? '3 2' : undefined}
              />
            )
          })}
        {drawn.map((s) => {
          const st = STYLE[s.model]
          return (
            <g key={s.model}>
              <path d={L(s.values) ?? ''} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} />
              {s.values.map((v, i) => (steps.length <= 6 || i % 3 === 2 || i === 0 ? <Mark key={i} shape={st.shape} cx={x(steps[i])} cy={y(v)} /> : null))}
            </g>
          )
        })}
        {ends.map(({ s, y: ly }) => (
          <text key={s.model} x={width - m.r + 8} y={ly} dy="0.32em" fontSize={11} fill="var(--ink)" fontWeight={s.model === 'gat' ? 600 : 400}>
            {STYLE[s.model].label.split(' ')[0]} <tspan className="num" fill="var(--ink-soft)">{fmt(s.values[s.values.length - 1], 2)}</tspan>
          </text>
        ))}
        {cursor !== null && (
          <g pointerEvents="none">
            <line x1={x(cursor)} x2={x(cursor)} y1={m.t} y2={height - m.b} stroke="var(--ink)" />
            {drawn.map((s) => (
              <Mark key={s.model} shape={STYLE[s.model].shape} cx={x(cursor)} cy={y(s.values[steps.indexOf(cursor)])} />
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
    </div>
  )
}

export function RolloutChart({ data = rollout, scope = 'mean over 8 basins' }: { data?: RolloutData | null; scope?: string } = {}) {
  const [cursor, setCursor] = useState<number | null>(null)
  if (!data) {
    return (
      <div className="pending-hatch border-hair border-paper-line p-6 text-small text-ink-soft">
        Per-step errors pending: no completed run with metrics.csv was found when the data was generated.
      </div>
    )
  }
  const ro = data
  const steps = ro.steps
  const withCi = ro.panels.ungauged.some((s) => s.lo && s.hi)
  const models: ModelKey[] = ['persistence', 'mlp', 'gcn', 'gat']
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = cursor ?? steps[0]
    setCursor(Math.max(steps[0], Math.min(steps[steps.length - 1], cur + (e.key === 'ArrowRight' ? 1 : -1))))
  }
  const at = cursor ?? steps[steps.length - 1]
  const idx = steps.indexOf(at)
  return (
    <div>
      <div
        tabIndex={0}
        onKeyDown={onKey}
        role="group"
        aria-label="Error by forecast hour for four models, gauged and ungauged nodes. Left and right arrow keys move the reading; values are listed in the table below the charts."
        className="grid gap-10 md:grid-cols-2"
      >
        <Panel title="Gauged nodes" series={ro.panels.gauged} steps={steps} cursor={cursor} setCursor={setCursor} />
        <Panel title="Ungauged nodes" series={ro.panels.ungauged} steps={steps} cursor={cursor} setCursor={setCursor} />
      </div>
      <table className="mt-6 w-full text-small">
        <caption className="pb-2 text-left text-micro text-ink-soft">
          Discharge RMSE ({ro.unit}) at forecast hour <span className="num">+{at}</span>, {scope}
          {withCi ? ', with the 95% interval from resampling events and seeds, and MAE' : ''}
        </caption>
        <thead>
          <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
            <th scope="col" className="py-1 pr-4 font-normal">Model</th>
            <th scope="col" className="py-1 pr-4 text-right font-normal">Gauged</th>
            <th scope="col" className="py-1 pr-4 text-right font-normal">Ungauged</th>
            {withCi && <th scope="col" className="py-1 pr-4 text-right font-normal">Ungauged 95% interval</th>}
            {withCi && <th scope="col" className="py-1 text-right font-normal">Ungauged MAE</th>}
          </tr>
        </thead>
        <tbody>
          {models.map((mk) => {
            const g = ro.panels.gauged.find((s) => s.model === mk)
            const u = ro.panels.ungauged.find((s) => s.model === mk)
            const pending = !g || g.status === 'pending'
            return (
              <tr key={mk} className={`border-b-hair border-paper-line ${pending ? 'pending-hatch text-ink-soft' : ''}`}>
                <th scope="row" className="flex items-center gap-2 py-1.5 pr-4 text-left font-normal">
                  <svg width="26" height="10" aria-hidden="true">
                    <line x1="0" x2="26" y1="5" y2="5" stroke={STYLE[mk].stroke} strokeWidth={STYLE[mk].width} strokeDasharray={STYLE[mk].dash} />
                    <Mark shape={STYLE[mk].shape} cx={13} cy={5} />
                  </svg>
                  {STYLE[mk].label}
                </th>
                <td className="num py-1.5 pr-4 text-right">{pending ? 'pending' : fmt(g!.values[idx], 3)}</td>
                <td className="num py-1.5 pr-4 text-right">{!u || u.status === 'pending' ? 'pending' : fmt(u.values[idx], 3)}</td>
                {withCi && (
                  <td className="num py-1.5 pr-4 text-right text-ink-soft">{u?.lo && u.hi ? `${fmt(u.lo[idx], 1)} to ${fmt(u.hi[idx], 1)}` : '—'}</td>
                )}
                {withCi && <td className="num py-1.5 text-right">{u?.mae ? fmt(u.mae[idx], 1) : '—'}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
