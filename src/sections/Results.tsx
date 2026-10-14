import { ablations, basinComparison, type BasinComparison } from '../data/results'
import { resultsCopy, tpl } from '../data/content'
import { ciText, excludesZero, intervalOf, metric, mv } from '../lib/metrics'
import { fmt, minus } from '../lib/format'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { RolloutChart } from '../components/RolloutChart'
import { MetricTable } from '../components/MetricTable'
import { StatusFigure } from '../components/StatusFigure'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'

type Row = NonNullable<BasinComparison>[number]

/* One table per split: held-out basins are never listed among the training basins. */
function BasinTable({ rows, caption }: { rows: Row[]; caption: string }) {
  if (!rows.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-figure-sm text-small">
        <caption className="pb-3 text-left text-small text-ink-soft">{caption}</caption>
        <thead>
          <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
            <th scope="col" className="py-1.5 pr-4 font-normal">Basin</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">Persistence</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">MLP</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">GCN</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">GAT</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">GAT vs GCN</th>
            <th scope="col" className="py-1.5 text-right font-normal">Per-seed range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.basin} className="border-b-hair border-paper-line">
              <th scope="row" className="num py-1.5 pr-4 text-left font-normal">{b.basin}</th>
              <td className="num py-1.5 pr-4 text-right text-ink-soft">{b.persistence == null ? '—' : fmt(b.persistence, 3)}</td>
              <td className="num py-1.5 pr-4 text-right text-ink-soft">{b.mlp == null ? '—' : fmt(b.mlp, 3)}</td>
              <td className="num py-1.5 pr-4 text-right">
                {fmt(b.gcn, 3)} <span className="text-micro text-ink-soft">± {fmt(b.gcnSd, 3)}</span>
              </td>
              <td className="num py-1.5 pr-4 text-right font-medium">
                {fmt(b.gat, 3)} <span className="text-micro font-normal text-ink-soft">± {fmt(b.gatSd, 3)}</span>
              </td>
              <td className="num py-1.5 pr-4 text-right">{fmt(b.gatVsGcnPct, 2, true)}%</td>
              <td className="num py-1.5 text-right text-ink-soft">
                {fmt(b.seedRangePct[0], 1, true)} to {fmt(b.seedRangePct[1], 1, true)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AblationTable() {
  if (!ablations) {
    return <p className="pending-hatch p-4 text-small text-ink-soft">Ablations pending: no ablation runs in provenance/.</p>
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
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">95% interval</th>
            <th scope="col" className="py-1.5 pr-4 text-right font-normal">Better in</th>
            <th scope="col" className="py-1.5 text-right font-normal">Attention r vs travel time</th>
          </tr>
        </thead>
        <tbody>
          {ablations.map((a) => {
            const holds = excludesZero(a.interval)
            return (
              <tr key={a.name} className="border-b-hair border-paper-line">
                <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                  {a.name}
                  <span className="num block text-micro text-ink-soft">config {a.configHash ?? '—'}</span>
                </th>
                <td className="num py-1.5 pr-4 text-micro text-ink-soft">{a.detail}</td>
                <td className="num py-1.5 pr-4 text-right">{fmt(a.rmse, 3)}</td>
                <td className="num py-1.5 pr-4 text-right">{a.vsRefPct == null ? '—' : `${fmt(a.vsRefPct, 2, true)}%`}</td>
                <td className="num py-1.5 pr-4 text-right">
                  {a.interval ? (
                    <span className={`border-b-2 border-ink pb-px ${holds ? 'border-solid' : 'border-dashed'}`}>
                      {ciText(a.interval)}
                      <span className="sr-only">{holds ? ', excludes zero' : ', includes zero'}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
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
  const hm = metric('gat_vs_gcn_held')
  const um = metric('undirected_gain')
  const und = ablations?.find((a) => a.name === 'undirected')
  const train = (basinComparison ?? []).filter((b) => b.split !== 'held_out')
  const held = (basinComparison ?? []).filter((b) => b.split === 'held_out')
  const gIv = intervalOf('gat_vs_gcn')
  const hIv = intervalOf('gat_vs_gcn_held')
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

      <ClaimBlock claim={claims.accuracy} size="h3" className="mt-14" />
      {gm && gm.status !== 'pending' ? (
        <div className="mt-8 grid gap-x-12 gap-y-6 lg:grid-cols-12">
          <StatusFigure id="gat_vs_gcn" size="compact" className="min-w-0 lg:col-span-4" caption="GAT over GCN, all eight basins pooled" />
          <div className="min-w-0 max-w-measure space-y-3 lg:col-span-8">
            <p className="text-lead text-ink">
              {tpl(resultsCopy.gatStatement, {
                imp: mv('gat_vs_gcn'),
                ci: ciText(gIv),
                verdictSentence: excludesZero(gIv) ? resultsCopy.gatHolds : resultsCopy.gatFails,
                basinsWon: mv('gat_basins_won'),
              })}
            </p>
            {gm.supersedes && <p className="text-small text-ink-soft">{tpl(resultsCopy.supersededNote, { old: minus(gm.supersedes) })}</p>}
          </div>
        </div>
      ) : (
        <p className="pending-hatch mt-14 max-w-measure p-4 text-lead text-ink-soft">GAT versus GCN: pending. Training has not finished.</p>
      )}

      <div className="mt-12">
        <BasinTable rows={train} caption={resultsCopy.trainCaption} />
      </div>

      {hm && hm.status !== 'pending' && (
        <div className="mt-16 border-t-hair border-ink pt-6">
          <h3 className="text-h3">{resultsCopy.heldHeading}</h3>
          <ClaimBlock claim={claims.heldOut} className="mt-4" />
          <div className="mt-6 grid gap-x-12 gap-y-6 lg:grid-cols-12">
            <StatusFigure id="gat_vs_gcn_held" size="compact" className="min-w-0 lg:col-span-4" caption="GAT over GCN, held-out basins only" />
            <div className="min-w-0 max-w-measure space-y-3 lg:col-span-8">
              <p className="text-body text-ink">
                {tpl(resultsCopy.heldStatement, {
                  held: mv('gat_vs_gcn_held'),
                  ci: ciText(hIv),
                  verdictSentence: excludesZero(hIv) ? resultsCopy.heldHolds : resultsCopy.heldFails,
                })}
              </p>
              {hm.supersedes && <p className="text-small text-ink-soft">{tpl(resultsCopy.supersededNote, { old: minus(hm.supersedes) })}</p>}
            </div>
          </div>
          <div className="mt-8">
            <BasinTable rows={held} caption={resultsCopy.heldCaption} />
          </div>
        </div>
      )}

      <h3 className="mt-20 text-h3">{resultsCopy.ablationHeading}</h3>
      <p className="mt-3 max-w-measure text-body text-ink-soft">{resultsCopy.ablationIntro}</p>
      <ClaimBlock claim={claims.undirected} className="mt-6" />
      {um && und && um.status !== 'pending' && (
        <div className="mt-6 grid gap-x-12 gap-y-6 lg:grid-cols-12">
          <StatusFigure id="undirected_gain" size="compact" className="min-w-0 lg:col-span-4" caption="Undirected graph vs the directed reference" />
          <p className="min-w-0 max-w-measure text-body lg:col-span-8">
            {tpl(resultsCopy.undirected, {
              gain: fmt(und.vsRefPct ?? 0, 1, true),
              betterIn: und.betterIn ?? '—',
              ci: ciText(und.interval),
              verdictSentence: excludesZero(und.interval) ? resultsCopy.undirectedHolds : resultsCopy.undirectedFails,
              old: minus(um.supersedes ?? ''),
              cov: mv('undir_coverage_r'),
            })}
          </p>
        </div>
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
