import type { ReactNode } from 'react'
import { findings, tpl } from '../data/content'
import { ciOf, isPending, mv, num } from '../lib/metrics'
import { fmt } from '../lib/format'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { CorrelatesChart, GateChart, TrapAxis } from '../components/FindingCharts'
import { StatusFigure } from '../components/StatusFigure'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims, type Claim } from '../data/claims'

/*
  The negative results carry the page. Each finding leads with the number
  that decided it, set large with its evidential status, then the account,
  then the evidence.
*/

function Finding({
  title,
  claim,
  figure,
  children,
  chart,
  caption,
}: {
  title: string
  claim: Claim
  figure: ReactNode
  children: ReactNode
  chart: ReactNode
  caption: string
}) {
  return (
    <article className="border-t-2 border-ink pt-6">
      <ClaimBlock claim={claim} size="h3" className="mb-10" />
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <h3 className="cut-semi text-h3 font-semibold">{title}</h3>
          <div className="mt-6">{figure}</div>
        </div>
        <div className="prose-body min-w-0 lg:col-span-7">{children}</div>
      </div>
      <figure className="mt-10">
        {chart}
        <figcaption className="mt-3 max-w-measure text-small text-ink-soft">{caption}</figcaption>
      </figure>
    </article>
  )
}

function BigNumber({ id, label, struck = false }: { id: string; label: string; struck?: boolean }) {
  return (
    <div className={`mb-8 ${struck ? '[&_.num]:line-through [&_.num]:decoration-2' : ''}`}>
      <StatusFigure id={id} size="figure" caption={label} />
    </div>
  )
}

export function Findings() {
  const w4 = findings.week4
  const trap = findings.trap
  const lrn = findings.learned
  const w4vars = {
    gcnWin: mv('w4_gcn_win'),
    gcnWinCi: ciOf('w4_gcn_win'),
    gcnHeld: mv('w4_gcn_held'),
    gcnHeldCi: ciOf('w4_gcn_held'),
    variability: mv('w4_gcn_variability'),
    ownR2: mv('w4_own_r2'),
    g6: mv('w4_gain_6h'),
    g12: mv('w4_gain_12h'),
    masked: fmt(100 - num('gauged_pct'), 0),
    horizon: mv('horizon_ratio'),
  }
  const gateVars = {
    gateAll: mv('gate_all'),
    gateServed: mv('gate_served'),
    xAll: fmt(num('gate_all') / 0.05, 1),
    xServed: fmt(num('gate_served') / 0.05, 1),
    k1: mv('gate_k1'),
    k12: mv('gate_k12'),
    b08: mv('gate_b08'),
    b08s: mv('gate_b08_served'),
    coverage: mv('gate_coverage'),
  }
  const trapVars = {
    untrained: mv('trap_untrained'),
    confRange: mv('trap_confound'),
    tests: mv('tests_passing'),
    r: mv('att_tt_r'),
    rCi: ciOf('att_tt_r'),
    rRouting: mv('att_tt_r_routing'),
    signs: mv('att_sign'),
    confound: mv('att_confound'),
    gap: mv('att_vs_confound'),
    gapCi: ciOf('att_vs_confound'),
    seed: mv('att_seed_r'),
  }
  const lrnVars = { area: mv('att_local_area'), q: mv('att_mean_q') }

  return (
    <Section id="findings" ground="paper">
      <SectionHead section="findings" id="findings-h">
        {findings.heading}
      </SectionHead>
      <p className="max-w-measure text-lead text-ink">{findings.intro}</p>

      <div className="mt-16 space-y-24">
        <Finding
          title={w4.title}
          claim={claims.week4}
          figure={
            <>
              <BigNumber id="w4_own_r2" label="R² of a node’s own 24-hour history, one hour ahead. Nothing left for the graph to explain." />
              <BigNumber id="gate_served" label="ΔR² from upstream gauges after the task was fixed, at ungauged nodes they can reach. Pass mark 0.05." />
            </>
          }
          chart={<GateChart />}
          caption={w4.chartCaption}
        >
          {w4.paragraphs.map((p, i) => (
            <p key={i}>{tpl(p, w4vars)}</p>
          ))}
          <ClaimBlock claim={claims.gate} />
          <p>{tpl(w4.gate, gateVars)}</p>
          <p className="text-ink-soft">{tpl(w4.exception, gateVars)}</p>
        </Finding>

        <Finding
          title={trap.title}
          claim={claims.trap}
          figure={
            <>
              <BigNumber id="trap_untrained" label="Plain within-node r on a GATv2 with random weights. The headline this metric would have produced, struck through." struck />
              <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <StatusFigure
                  id="att_tt_r"
                  size="reading"
                  className="mb-8"
                  caption={isPending('att_tt_r') ? trap.pendingLabel : 'Hop-stratified r on the trained model, against a permutation null.'}
                />
                <StatusFigure id="att_confound" size="reading" className="mb-8" caption="Reach length alone. Higher than the trained attention." />
              </div>
            </>
          }
          chart={<TrapAxis />}
          caption={trap.chartCaption}
        >
          {trap.paragraphs.map((p, i) =>
            i === trap.paragraphs.length - 1 && isPending('att_tt_r') ? (
              <p key={i} className="text-ink-soft">{trap.pendingParagraph}</p>
            ) : (
              <p key={i}>{tpl(p, trapVars)}</p>
            ),
          )}
        </Finding>

        <Finding
          title={lrn.title}
          claim={claims.learned}
          figure={
            <BigNumber id="att_local_area" label="Correlation of attention with upstream contributing area, same sign in all 8 basins." />
          }
          chart={<CorrelatesChart />}
          caption={lrn.chartCaption}
        >
          {isPending('att_local_area') ? (
            <p className="text-ink-soft">{lrn.pending}</p>
          ) : (
            lrn.paragraphs.map((p, i) => <p key={i}>{tpl(p, lrnVars)}</p>)
          )}
        </Finding>
      </div>
    </Section>
  )
}
