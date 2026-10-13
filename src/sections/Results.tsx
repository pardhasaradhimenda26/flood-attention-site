import { ablations, basinComparison } from '../data/results'
import { resultsCopy, tpl } from '../data/content'
import { metric, mv } from '../lib/metrics'
import { fmt } from '../lib/format'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { RolloutChart } from '../components/RolloutChart'
import { MetricTable } from '../components/MetricTable'

function BasinTable() {
  if (!basinComparison) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-figure-sm text-small">
        <caption className="pb-3 text-left text-small text-ink-soft">{resultsCopy.basinsCaption}</caption>
        <thead>
          <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
            <th scope="col" className="py-1.5 pr-4 font-normal">Basin</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">Persistence</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">MLP</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">GCN</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">GAT</th>
            <th scope="col" className="py-1.5 text-right font-normal">GAT vs GCN</th>
          </tr>
        </thead>
        <tbody>
          {basinComparison.map((b) => (
            <tr key={b.basin} className="border-b-hair border-paper-line">
              <th scope="row" className="num py-1.5 pr-4 text-left font-normal">
                {b.basin}
                {b.split === 'held_out' && <span className="ml-2 font-sans text-micro text-ink-soft">held out</span>}
              </th>
              <td className="num py-1.5 pr-4 text-right text-ink-soft">{fmt(b.persistence, 3)}</td>
              <td className="num py-1.5 pr-4 text-right text-ink-soft">{fmt(b.mlp, 3)}</td>
              <td className="num py-1.5 pr-4 text-right">
                {fmt(b.gcn, 3)} <span className="text-micro text-ink-soft">± {fmt(b.gcnSd, 3)}</span>
              </td>
              <td className="num py-1.5 pr-4 text-right font-medium">
                {fmt(b.gat, 3)} <span className="text-micro font-normal text-ink-soft">± {fmt(b.gatSd, 3)}</span>
              </td>
              <td className="num py-1.5 text-right">{fmt(b.gatVsGcnPct, 2, true)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AblationTable() {
  if (!ablations) {
    return <p className="pending-hatch p-4 text-small text-ink-soft">Ablations pending: results/ablations.csv not found.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-figure-sm text-small">
        <caption className="pb-3 text-left text-small text-ink-soft">{resultsCopy.ablationCaption}</caption>
        <thead>
          <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
            <th scope="col" className="py-1.5 pr-4 font-normal">Change</th>
            <th scope="col" className="py-1.5 pr-4 font-normal">Configuration</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">Ungauged RMSE</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">vs reference</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">p</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">Better in</th>
            <th scope="col" className="py-1.5 text-right font-normal">Attention r vs travel time</th>
          </tr>
        </thead>
        <tbody>
          {ablations.map((a) => {
            const strong = a.name === 'undirected'
            return (
              <tr key={a.name} className={`border-b-hair border-paper-line ${strong ? 'font-medium' : ''}`}>
                <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                  <span className={strong ? 'font-semibold' : ''}>{a.name}</span>
                </th>
                <td className="num py-1.5 pr-4 text-micro text-ink-soft">{a.detail}</td>
                <td className="num py-1.5 pr-4 text-right">{fmt(a.rmse, 3)}</td>
                <td className="num py-1.5 pr-4 text-right">{a.vsRefPct == null ? '—' : `${fmt(a.vsRefPct, 2, true)}%`}</td>
                <td className="num py-1.5 pr-4 text-right">{a.p == null ? '—' : fmt(a.p, 3)}</td>
                <td className="num py-1.5 pr-4 text-right">{a.betterIn ?? '—'}</td>
                <td className="num py-1.5 text-right">{fmt(a.attnR, 3, true)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Results() {
  const gm = metric('gat_vs_gcn')
  const und = ablations?.find((a) => a.name === 'undirected')
  return (
    <Section id="results" ground="paper">
      <SectionHead section="results" id="results-h">
        {resultsCopy.heading}
      </SectionHead>
      <p className="max-w-measure text-body">{resultsCopy.intro}</p>

      <div className="mt-12">
        <RolloutChart />
        <p className="mt-4 max-w-measure text-small text-ink-soft">{resultsCopy.rolloutCaption}</p>
      </div>

      {gm && gm.status === 'verified' ? (
        <p className="mt-14 max-w-measure border-l-2 border-ink pl-4 text-lead text-ink">
          {tpl(resultsCopy.gatStatement, {
            basinsWon: mv('gat_basins_won'),
            imp: mv('gat_vs_gcn'),
            pNote: gm.note ?? '',
            held: mv('gat_vs_gcn_held'),
          })}
        </p>
      ) : (
        <p className="pending-hatch mt-14 max-w-measure p-4 text-lead text-ink-soft">GAT versus GCN: pending. Training has not finished.</p>
      )}

      <div className="mt-12">
        <BasinTable />
      </div>

      <h3 className="mt-20 text-h3">{resultsCopy.ablationHeading}</h3>
      <p className="mt-3 max-w-measure text-body text-ink-soft">{resultsCopy.ablationIntro}</p>
      {und && und.p != null && (
        <p className="mt-6 max-w-measure text-body">
          {tpl(resultsCopy.undirected, { gain: fmt(und.vsRefPct ?? 0, 1), p: fmt(und.p, 3), cov: mv('undir_coverage_r') })}
        </p>
      )}
      <div className="mt-8">
        <AblationTable />
      </div>

      <h3 className="mt-20 text-h3">{resultsCopy.tableHeading}</h3>
      <p className="mb-8 mt-3 max-w-measure text-body text-ink-soft">{resultsCopy.tableIntro}</p>
      <MetricTable />
    </Section>
  )
}
