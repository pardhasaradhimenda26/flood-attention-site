import { problem } from '../data/content'
import { problemHydrograph } from '../data/network'
import { metric } from '../lib/metrics'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { Hydrograph } from '../components/Hydrograph'
import { hydroStats } from '../lib/hydro'
import { Rich } from '../components/Rich'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'
import { lagHours } from '../lib/storm'

/** The real network as a unit chart: one mark per cross-section. Proportion only, not position. */
function GaugeStrip({ sections, gauges }: { sections: number; gauges: number }) {
  const at = new Set(Array.from({ length: gauges }, (_, i) => i))
  return (
    <figure className="mt-10">
      <svg viewBox={`0 0 ${sections * 14} 30`} className="w-full max-w-measure" role="img" aria-label={`${sections} cross-sections, ${gauges} of them gauged`}>
        <defs>
          <pattern id="strip-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink-soft)" strokeWidth="0.8" opacity="0.5" />
          </pattern>
        </defs>
        {Array.from({ length: sections }, (_, i) => (
          <g key={i} transform={`translate(${i * 14 + 1} 2)`}>
            <rect width="11" height="18" fill={at.has(i) ? 'var(--ink)' : 'url(#strip-hatch)'} stroke="var(--ink-soft)" strokeWidth="0.6" />
          </g>
        ))}
        <line x1="0" x2={sections * 14} y1="26" y2="26" stroke="var(--ink-soft)" strokeWidth="0.6" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-6 text-small text-ink-soft">
        <span>
          <span className="num text-ink">{gauges}</span> gauged
        </span>
        <span>
          <span className="num text-ink">{sections - gauges}</span> with no record
        </span>
      </figcaption>
    </figure>
  )
}

export function Problem() {
  const sections = Number(metric('real_sections')?.value ?? 28)
  const gauges = Number(metric('real_gauges')?.value ?? 4)
  const vars = {
    sections,
    gauges,
    unmeasured: sections - gauges,
    pct: Math.round((100 * (sections - gauges)) / sections),
    lag: lagHours,
  }
  const st = hydroStats()
  return (
    <Section id="problem" ground="paper">
      <SectionHead section="problem" id="problem-h">
        {problem.heading}
      </SectionHead>
      <ClaimBlock claim={claims.unmeasured} size="h3" className="mb-10" />
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="prose-body min-w-0 lg:col-span-7">
          {problem.paragraphs.map((p, i) => (
            <p key={i}>
              <Rich text={p} vars={vars} />
            </p>
          ))}
          <GaugeStrip sections={sections} gauges={gauges} />
        </div>
      </div>
      <figure className="mt-16 border-t-hair border-ink pt-4">
        <h3 className="mb-4 text-h3">{problem.figureTitle}</h3>
        <ClaimBlock claim={claims.lag} className="mb-8" />
        <Hydrograph />
        <figcaption className="mt-5 max-w-measure text-small text-ink-soft">
          <Rich
            text={problem.caption}
            vars={{
              up: st.up,
              down: st.down,
              reaches: problemHydrograph.reaches,
              lag: st.lagRouted,
              pct: st.pctRouted,
            }}
          />
        </figcaption>
      </figure>
    </Section>
  )
}
