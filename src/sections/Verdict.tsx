import { VERDICT_ROWS, verdict } from '../data/content'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { StatusFigure, StatusLine } from '../components/StatusFigure'
import { VerdictChart } from '../components/VerdictChart'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'

/*
  The first thing below the hero. Both claims and their evidential status in
  one view, so a reader who scrolls past at speed still leaves knowing the
  accuracy gain is qualified and the interpretability result is null. The
  attention correlations and the baseline that beats them are set at the same
  size: the reader sees the baseline win without reading a word.
*/
export function Verdict() {
  const acc = verdict.accuracy
  const att = verdict.attention
  return (
    <Section id="verdict" ground="paper">
      <SectionHead section="verdict" id="verdict-h">
        {verdict.heading}
      </SectionHead>
      <p className="max-w-measure text-lead text-ink">{verdict.intro}</p>

      <div className="mt-14 grid gap-x-12 gap-y-16 lg:grid-cols-12">
        <article aria-labelledby="verdict-acc" className="min-w-0 border-t-2 border-ink pt-5 lg:col-span-5">
          <h3 id="verdict-acc" className="cut-semi text-h3 font-semibold">{acc.title}</h3>
          <ClaimBlock claim={claims.accuracy} className="mt-4" />
          <StatusFigure id="gat_vs_gcn" size="figure" caption={acc.caption} className="mt-8" />
          <div className="mt-10 border-t-hair border-ink pt-4">
            <h4 className="text-small font-semibold text-ink">{acc.heldTitle}</h4>
            <ClaimBlock claim={claims.heldOut} className="mt-3" />
            <StatusFigure id="gat_vs_gcn_held" size="compact" caption={acc.heldCaption} className="mt-3" />
          </div>
        </article>

        <article aria-labelledby="verdict-att" className="min-w-0 border-t-2 border-ink pt-5 lg:col-span-7">
          <h3 id="verdict-att" className="cut-semi text-h3 font-semibold">{att.title}</h3>
          <ClaimBlock claim={claims.physicsNull} className="mt-4" />
          <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {VERDICT_ROWS.map((r) => (
              <StatusFigure key={r.id} id={r.id} size="reading" caption={att.captions[r.id]} className="min-w-0" />
            ))}
          </div>
          <figure className="mt-10">
            <VerdictChart />
            <figcaption className="mt-3 max-w-measure text-small text-ink-soft">{att.chartCaption}</figcaption>
          </figure>
          <StatusLine id="att_vs_confound" label={att.gap} className="mt-4" />
        </article>
      </div>

      <ClaimBlock claim={claims.realPending} className="mt-14" />
    </Section>
  )
}
