import { scaleLinear } from 'd3-scale'
import { attentionByBasin } from '../data/results'
import { num } from '../lib/metrics'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'

/* Charts for the findings. Ink only: none of these values is an attention weight. */

/** Week 4 information test against the Week 5 gate, by lead time. */
export function GateChart() {
  const [ref, width] = useMeasure<HTMLDivElement>(560)
  const leads = [1, 6, 12]
  const w4 = [num('w4_gain_1h'), num('w4_gain_6h'), num('w4_gain_12h')]
  const gate = [num('gate_k1'), num('gate_k6'), num('gate_k12')]
  const thr = 0.05
  const height = 230
  const m = { t: 18, r: 150, b: 34, l: 52 }
  const x = scaleLinear().domain([0, 12.5]).range([m.l, width - m.r])
  const y = scaleLinear().domain([-0.03, 0.27]).range([height - m.b, m.t])
  const pts = (vals: number[]) =>
    vals.map((v, i) => (Number.isFinite(v) ? `${x(leads[i])},${y(v)}` : null)).filter(Boolean).join(' ')
  const ok = (v: number) => Number.isFinite(v)
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" role="img" aria-label={`Mean R squared gained from upstream information. Week 4: ${w4.map((v) => fmt(v, 4, true)).join(', ')} at 1, 6 and 12 hours. Week 5 gate, nodes with a gauged ancestor: ${gate.map((v) => fmt(v, 3, true)).join(', ')}. Pass mark 0.05.`}>
        {[0, 0.1, 0.2].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--paper-line)" />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--ink-soft)">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={m.l - 8} y={m.t - 6} textAnchor="end" fontSize={11} fill="var(--ink-soft)">ΔR²</text>
        <line x1={m.l} x2={width - m.r} y1={y(thr)} y2={y(thr)} stroke="var(--ink)" strokeDasharray="5 4" />
        <text x={width - m.r + 8} y={y(thr)} dy="0.32em" fontSize={11} fill="var(--ink)">
          pass mark <tspan className="num">0.05</tspan>
        </text>
        {leads.map((l) => (
          <text key={l} x={x(l)} y={height - 12} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
            {l} h
          </text>
        ))}
        <polyline points={pts(w4)} fill="none" stroke="var(--ink-soft)" strokeWidth={1.5} strokeDasharray="2 3" />
        {w4.map((v, i) => ok(v) && (
          <circle key={i} cx={x(leads[i])} cy={y(v)} r={4} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={1.5} />
        ))}
        <polyline points={pts(gate)} fill="none" stroke="var(--ink)" strokeWidth={2} />
        {gate.map((v, i) => ok(v) && (
          <rect key={i} x={x(leads[i]) - 4} y={y(v) - 4} width={8} height={8} fill="var(--ink)" />
        ))}
        <text x={x(12) + 10} y={y(gate[2])} dy="0.32em" fontSize={11} fill="var(--ink)">
          Week 5 gate <tspan className="num">{fmt(gate[2], 3, true)}</tspan>
        </text>
        <text x={x(12) + 10} y={y(w4[2]) + 4} dy="0.32em" fontSize={11} fill="var(--ink-soft)">
          Week 4 <tspan className="num">{fmt(w4[2], 3, true)}</tspan>
        </text>
      </svg>
    </div>
  )
}

/** Every number in the trap story on one correlation axis. */
export function TrapAxis() {
  const [ref, width] = useMeasure<HTMLDivElement>(720)
  const height = 250
  const m = { l: 24, r: 24 }
  const x = scaleLinear().domain([-1, 1]).range([m.l, width - m.r])
  const axisY = 130
  const untrained = num('trap_untrained')
  const honest = num('att_tt_r')
  const confound = num('att_confound')
  const refs = [num('ref_routing'), num('ref_all')]
  const narrow = width < 560
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" role="img" aria-label={`Correlation axis from minus one to one. Untrained model, plain within-node r: ${untrained}. Hop-count confound, reach length against travel time: 0.97 to 0.99. References 0.698 and 0.769. Reach-length baseline ${fmt(confound, 3, true)}. Trained model, hop-stratified: ${fmt(honest, 3, true)}, at chance.`}>
        <line x1={x(-1)} x2={x(1)} y1={axisY} y2={axisY} stroke="var(--ink)" />
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={axisY - 5} y2={axisY + 5} stroke="var(--ink)" />
            <text x={x(t)} y={axisY + 20} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
              {t === 0 ? '0' : fmt(t, 1, t > 0)}
            </text>
          </g>
        ))}
        <text x={x(-1)} y={axisY + 38} fontSize={11} fill="var(--ink-soft)">within-node correlation with travel time</text>

        {/* the confound band and the false headline above the axis */}
        <rect x={x(0.97)} y={axisY - 70} width={Math.max(3, x(0.99) - x(0.97))} height={70} fill="var(--ink-soft)" opacity={0.25} />
        <line x1={x(untrained)} x2={x(untrained)} y1={axisY - 92} y2={axisY} stroke="var(--ink)" strokeWidth={2} />
        <circle cx={x(untrained)} cy={axisY - 92} r={5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={2} />
        <text x={x(untrained) - 10} y={axisY - 104} textAnchor="end" fontSize={12} fill="var(--ink)">
          untrained GATv2, plain metric <tspan className="num" fontWeight={500}>{untrained}</tspan>
        </text>
        <text x={x(0.97) - 8} y={axisY - 56} textAnchor="end" fontSize={11} fill="var(--ink-soft)">
          {narrow ? 'hop-count confound' : 'reach length vs travel time, within node'}{' '}
          <tspan className="num">0.97–0.99</tspan>
        </text>

        {/* references and baseline */}
        {refs.filter(Number.isFinite).map((r, i) => (
          <g key={i}>
            <line x1={x(r)} x2={x(r)} y1={axisY - 26} y2={axisY} stroke="var(--ink-soft)" strokeDasharray="2 2" />
          </g>
        ))}
        <text x={x(refs[0]) - 6} y={axisY - 30} textAnchor="end" fontSize={11} fill="var(--ink-soft)">
          references <tspan className="num">{refs.map((r) => r.toFixed(3)).join(' / ')}</tspan>
        </text>
        {Number.isFinite(confound) && (
          <>
            <line x1={x(confound)} x2={x(confound)} y1={axisY} y2={axisY + 52} stroke="var(--ink-soft)" />
            <text x={x(confound) + 6} y={axisY + 62} fontSize={11} fill="var(--ink-soft)">
              reach-length baseline <tspan className="num">{fmt(confound, 3, true)}</tspan>
            </text>
          </>
        )}

        {/* the honest number and the per-basin spread below the axis */}
        {(attentionByBasin ?? []).map((b) => (
          <circle
            key={b.basin}
            cx={x(b.r)}
            cy={axisY + 82}
            r={4}
            fill={b.p < 0.05 ? 'var(--ink)' : 'var(--paper)'}
            stroke="var(--ink)"
            strokeWidth={1.2}
          >
            <title>{`${b.basin}: r = ${fmt(b.r, 3, true)}, p = ${fmt(b.p, 3)}`}</title>
          </circle>
        ))}
        {Number.isFinite(honest) ? (
          <>
            <line x1={x(honest)} x2={x(honest)} y1={axisY} y2={axisY + 96} stroke="var(--ink)" strokeWidth={2} />
            <rect x={x(honest) - 6} y={axisY - 6} width={12} height={12} fill="var(--ink)" />
            <text x={x(honest) - 10} y={axisY + 110} textAnchor="end" fontSize={12} fill="var(--ink)">
              trained, hop-stratified <tspan className="num" fontWeight={500}>{fmt(honest, 3, true)}</tspan>
            </text>
          </>
        ) : (
          <text x={x(0)} y={axisY + 110} textAnchor="middle" fontSize={12} fill="var(--ink-soft)">
            trained model, hop-stratified: pending
          </text>
        )}
        <text x={x(-1)} y={axisY + 86} dy="0.32em" fontSize={10} fill="var(--ink-soft)">
          each basin (filled: p &lt; 0.05)
        </text>
      </svg>
    </div>
  )
}

/** What attention correlates with instead. */
export function CorrelatesChart() {
  const [ref, width] = useMeasure<HTMLDivElement>(560)
  const rows = [
    { k: 'att_local_area', label: 'upstream local area' },
    { k: 'att_mean_q', label: 'upstream mean discharge' },
    { k: 'att_drainage', label: 'upstream drainage area' },
    { k: 'att_reach', label: 'reach length' },
    { k: 'att_tt_r', label: 'travel time — the thesis claim' },
  ]
  const rowH = 30
  const height = rows.length * rowH + 30
  const labelW = Math.min(230, width * 0.42)
  const x = scaleLinear().domain([0, 1]).range([labelW, width - 56])
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" role="img" aria-label={rows.map((r) => `${r.label}: ${Number.isFinite(num(r.k)) ? fmt(num(r.k), 3, true) : 'pending'}`).join('. ')}>
        <defs>
          <pattern id="corr-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-soft)" strokeWidth="0.7" opacity="0.4" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={4} y2={height - 24} stroke="var(--paper-line)" />
            <text x={x(t)} y={height - 8} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const v = num(r.k)
          const yy = 16 + i * rowH
          const claim = r.k === 'att_tt_r'
          if (!Number.isFinite(v)) {
            return (
              <g key={r.k}>
                <text x={labelW - 12} y={yy} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--ink-soft)">
                  {r.label}
                </text>
                <rect x={x(0)} y={yy - 7} width={x(1) - x(0)} height={14} fill="url(#corr-hatch)" />
                <text x={x(0) + 8} y={yy} dy="0.32em" fontSize={11} fill="var(--ink-soft)">pending</text>
              </g>
            )
          }
          return (
            <g key={r.k}>
              <text x={labelW - 12} y={yy} dy="0.32em" textAnchor="end" fontSize={12} fill={claim ? 'var(--ink)' : 'var(--ink-soft)'} fontWeight={claim ? 600 : 400}>
                {r.label}
              </text>
              <line x1={x(0)} x2={x(Math.max(0, v))} y1={yy} y2={yy} stroke="var(--ink)" strokeWidth={claim ? 1 : 2} />
              <circle cx={x(Math.max(0, v))} cy={yy} r={claim ? 5 : 4} fill={claim ? 'var(--paper)' : 'var(--ink)'} stroke="var(--ink)" strokeWidth={1.5} />
              <text x={x(Math.max(0, v)) + 10} y={yy} dy="0.32em" className="num" fontSize={12} fill="var(--ink)">
                {fmt(v, 3, true)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
