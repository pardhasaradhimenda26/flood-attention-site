import type { ReactNode } from 'react'
import { findings, tpl } from '../data/content'
import { isPending, mv } from '../lib/metrics'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { CorrelatesChart, GateChart, TrapAxis } from '../components/FindingCharts'

/*
  The negative results carry the page. Each finding leads with the number
  that decided it, set large, then the account, then the evidence.
*/

function Finding({
  title,
  figure,
  children,
  chart,
  caption,
}: {
  title: string
  figure: ReactNode
  children: ReactNode
  chart: ReactNode
  caption: string
}) {
  return (
    <article className="border-t-2 border-ink pt-6">
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h3 className="cut-semi text-h3 font-semibold">{title}</h3>
          <div className="mt-6">{figure}</div>
        </div>
        <div className="prose-body lg:col-span-7">{children}</div>
      </div>
      <figure className="mt-10">
        {chart}
        <figcaption className="mt-3 max-w-measure text-small text-ink-soft">{caption}</figcaption>
      </figure>
    </article>
  )
}

function BigNumber({ value, label, struck = false, muted = false }: { value: string; label: string; struck?: boolean; muted?: boolean }) {
  const pending = value === 'pending'
  return (
    <div className={`mb-5 ${pending ? 'pending-hatch' : ''}`}>
      <div className={`num text-figure tracking-tightish ${muted || pending ? 'text-ink-soft' : 'text-ink'} ${struck ? 'line-through decoration-2' : ''}`}>
        {value}
      </div>
      <p className="mt-2 max-w-caption text-small text-ink-soft">{label}</p>
    </div>
  )
}

export function Findings() {
  const w4 = findings.week4
  const trap = findings.trap
  const lrn = findings.learned
  const w4vars = { gcnWin: mv('w4_gcn_win'), ownR2: mv('w4_own_r2'), g6: mv('w4_gain_6h'), g12: mv('w4_gain_12h') }
  const gateVars = {
    gateAll: mv('gate_all'),
    gateServed: mv('gate_served'),
    k1: mv('gate_k1'),
    k12: mv('gate_k12'),
    b08: mv('gate_b08'),
    b08s: mv('gate_b08_served'),
    coverage: mv('gate_coverage'),
  }
  const trapVars = { r: mv('att_tt_r'), signs: mv('att_sign'), confound: mv('att_confound') }
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
          figure={
            <>
              <BigNumber value={mv('w4_own_r2')} label="R² of a node’s own 24-hour history, one hour ahead. Nothing left for the graph to explain." />
              <BigNumber value={mv('gate_served')} label="ΔR² from upstream gauges after the task was fixed, at ungauged nodes they can reach. Pass mark 0.05." />
            </>
          }
          chart={<GateChart />}
          caption={w4.chartCaption}
        >
          {w4.paragraphs.map((p, i) => (
            <p key={i}>{tpl(p, w4vars)}</p>
          ))}
          <p>{tpl(w4.gate, gateVars)}</p>
          <p className="text-ink-soft">{tpl(w4.exception, gateVars)}</p>
        </Finding>

        <Finding
          title={trap.title}
          figure={
            <>
              <BigNumber value={mv('trap_untrained')} label="Plain within-node r on a GATv2 with random weights. The headline this metric would have produced." struck />
              <BigNumber
                value={mv('att_tt_r')}
                label={isPending('att_tt_r') ? trap.pendingLabel : 'Hop-stratified r on the trained model, against a permutation null. Chance.'}
              />
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
          figure={
            <BigNumber value={mv('att_local_area')} label="Correlation of attention with upstream contributing area, same sign in all 8 basins." />
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
