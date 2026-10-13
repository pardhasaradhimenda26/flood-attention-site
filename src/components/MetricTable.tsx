import { metrics, type Metric } from '../data/results'
import { fmtValue, minus } from '../lib/format'

/*
  Every number, with its source. A pending metric is hatched, muted and says
  "pending" in words — it is listed so its absence is visible, and flips to
  verified automatically when generate_data.py finds the run.
*/

const GROUPS: [string, string][] = [
  ['dataset', 'Synthetic dataset'],
  ['week4', 'Week 4 information test'],
  ['gate', 'Week 5 gate'],
  ['model', 'Models, ungauged nodes'],
  ['attention', 'Attention'],
  ['ablation', 'Ablations'],
  ['rigor', 'Rigor'],
  ['real', 'Real network and open questions'],
]

function Row({ m }: { m: Metric }) {
  const pending = m.status === 'pending'
  return (
    <tr className={`border-b-hair border-paper-line align-baseline ${pending ? 'pending-hatch' : ''}`}>
      <th scope="row" className={`py-2 pr-4 text-left font-normal ${pending ? 'text-ink-soft' : 'text-ink'}`}>
        {m.label}
        {m.note && <span className="mt-0.5 block text-micro text-ink-soft">{minus(m.note)}</span>}
      </th>
      <td className="num whitespace-nowrap py-2 pr-4 text-right">
        {pending ? (
          <span className="text-ink-soft">pending</span>
        ) : (
          <>
            {fmtValue(m.value)}
            {m.unit && <span className="text-ink-soft">{m.unit === '%' || m.unit === '×' ? m.unit : ` ${m.unit}`}</span>}
          </>
        )}
      </td>
      <td className="num hidden py-2 text-micro text-ink-soft md:table-cell">{m.source ?? '—'}</td>
    </tr>
  )
}

export function MetricTable() {
  return (
    <div className="space-y-10">
      {GROUPS.map(([g, title]) => {
        const rows = metrics.filter((m) => m.group === g)
        if (!rows.length) return null
        return (
          <table key={g} className="w-full text-small">
            <caption className="pb-2 text-left text-small font-semibold text-ink">{title}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Value</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody className="border-t-hair border-ink">
              {rows.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </tbody>
          </table>
        )
      })}
    </div>
  )
}
