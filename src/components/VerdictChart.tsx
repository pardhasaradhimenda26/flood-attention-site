import { scaleLinear } from 'd3-scale'
import { metric, num, intervalOf } from '../lib/metrics'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'
import { STATUS_WORD } from '../lib/status'
import { VERDICT_ROWS } from '../data/content'

/*
  The interpretability result in one view: the two attention correlations, the
  reach-length baseline and the seed agreement on one r axis, each with its 95%
  interval. Same mark, same stroke for every row, so the baseline is seen to win
  on position alone. Interval line style follows the status language: dashed
  for qualified, solid for verified. Ink only: none of these is an attention
  weight.
*/

export function VerdictChart() {
  const [ref, width] = useMeasure<HTMLDivElement>(640)
  const narrow = width < 520
  const rowH = narrow ? 52 : 40
  const top = 8
  const height = top + VERDICT_ROWS.length * rowH + 34
  const labelW = narrow ? 0 : Math.min(260, width * 0.4)
  const x = scaleLinear().domain([-1, 1]).range([labelW + 8, width - 78])
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" aria-hidden="true">
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={height - 26} stroke={t === 0 ? 'var(--ink)' : 'var(--paper-line)'} />
            <text x={x(t)} y={height - 10} textAnchor="middle" className="num" fontSize={11} fill="var(--ink-soft)">
              {t === 0 ? '0' : fmt(t, 1, t > 0)}
            </text>
          </g>
        ))}
        {VERDICT_ROWS.map((row, i) => {
          const m = metric(row.id)
          const v = num(row.id)
          const iv = intervalOf(row.id)
          const yy = top + i * rowH + (narrow ? 34 : rowH / 2)
          const dashed = m?.status === 'qualified'
          return (
            <g key={row.id}>
              <text
                x={narrow ? x(-1) : labelW - 4}
                y={narrow ? yy - 18 : yy}
                dy="0.32em"
                textAnchor={narrow ? 'start' : 'end'}
                fontSize={12}
                fill="var(--ink)"
              >
                {row.label}
              </text>
              {Number.isFinite(v) ? (
                <>
                  {iv && (
                    <line x1={x(iv.lo)} x2={x(iv.hi)} y1={yy} y2={yy} stroke="var(--ink)" strokeWidth={2} strokeDasharray={dashed ? '5 3' : undefined} />
                  )}
                  <rect x={x(v) - 5} y={yy - 5} width={10} height={10} fill="var(--ink)" />
                  <text x={width - 72} y={yy} dy="0.32em" className="num" fontSize={12} fill="var(--ink)">
                    {fmt(v, 3, true)}
                  </text>
                  <text x={width - 72} y={yy + 13} dy="0.32em" fontSize={10} fill="var(--ink-soft)">
                    {STATUS_WORD[m!.status].toLowerCase()}
                  </text>
                </>
              ) : (
                <text x={x(0)} y={yy} dy="0.32em" fontSize={12} fill="var(--ink-soft)">
                  pending
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
