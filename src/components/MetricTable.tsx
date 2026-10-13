import { metrics, type Metric } from '../data/results'
import { fmtValue, minus } from '../lib/format'
import { STATUS_WORD, unitText } from '../lib/status'

/*
  Every number, with its status and source. The value cell carries the status
  rule (solid verified, dashed qualified, hatched pending); the status column
  says it in words, with the qualifier beside it. The source column names the
  file, whether the value was recomputed or read, and the run and config hash
  behind it.
*/

const GROUPS: [string, string][] = [
  ['dataset', 'Synthetic dataset'],
  ['week4', 'Week 4 information test'],
  ['gate', 'Week 5 gate'],
  ['model', 'Models, ungauged nodes, all basins'],
  ['heldout', 'Models, held-out basins only'],
  ['attention', 'Attention'],
  ['ablation', 'Ablations'],
  ['rigor', 'Rigor'],
  ['real', 'Real network and open questions'],
]

function Row({ m }: { m: Metric }) {
  const pending = m.status === 'pending'
  return (
    <tr data-status={m.status} className={`border-b-hair border-paper-line align-baseline ${pending ? 'pending-hatch' : ''}`}>
      <th scope="row" className={`py-2 pr-4 text-left font-normal ${pending ? 'text-ink-soft' : 'text-ink'}`}>
        {m.label}
        {m.note && <span className="mt-0.5 block text-micro text-ink-soft">{minus(m.note)}</span>}
      </th>
      <td className="num whitespace-nowrap py-2 pr-4 text-right">
        {pending ? (
          <span className="font-light text-ink-soft">pending</span>
        ) : (
          <span className={`border-b-2 border-ink pb-px ${m.status === 'qualified' ? 'border-dashed' : 'border-solid'}`}>
            {fmtValue(m.value)}
            {m.unit && <span className="text-ink-soft">{unitText(m)}</span>}
          </span>
        )}
      </td>
      <td className="py-2 pr-4 text-micro text-ink">
        <span className="font-semibold">{STATUS_WORD[m.status]}</span>
        {m.status === 'qualified' && m.qualifier && <span>: {minus(m.qualifier)}</span>}
      </td>
      <td className="hidden py-2 text-micro text-ink-soft md:table-cell">
        {m.source ? (
          <>
            <span>{m.derivation === 'read' ? 'read from ' : 'recomputed from '}</span>
            <span className="num break-all">{m.source.replace(/^provenance\//, '')}</span>
            {m.run && (
              <span className="mt-0.5 block">
                run <span className="num break-all">{m.run}</span>
                {m.configHash && (
                  <>
                    , config <span className="num">{m.configHash}</span>
                  </>
                )}
              </span>
            )}
          </>
        ) : (
          '—'
        )}
      </td>
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
                <th scope="col">Status</th>
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
