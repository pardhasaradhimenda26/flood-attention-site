import { approach, tpl } from '../data/content'
import { metric } from '../lib/metrics'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { Continuity, EquationBlock, GatV2, Muskingum, Residual } from '../components/EquationBlock'

export function Approach() {
  const edges = Number(metric('edges')?.value ?? 651)
  const note = metric('edges')?.note ?? ''
  const routing = Number(/(\d+) routing/.exec(note)?.[1] ?? 225)
  const vars = {
    nodes: String(metric('nodes')?.value ?? 233),
    edges,
    routing,
    message: edges - routing,
  }
  const eq = approach.equations
  return (
    <Section id="approach" ground="paper">
      <SectionHead section="approach" id="approach-h">
        {approach.heading}
      </SectionHead>
      <p className="max-w-measure text-lead text-ink">{approach.intro}</p>

      {/* The one genuine sequence on the page, so it is numbered. */}
      <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {approach.steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-lead gap-x-5">
            <span className="num text-h3 leading-none text-ink-soft" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-h3">{s.title}</h3>
              <p className="mt-3 max-w-narrow text-body text-ink-soft">{tpl(s.body, vars)}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-20">
        <EquationBlock name={eq.continuity.name} plain={eq.continuity.plain}>
          <Continuity />
        </EquationBlock>
        <EquationBlock name={eq.muskingum.name} plain={eq.muskingum.plain}>
          <Muskingum />
        </EquationBlock>
        <EquationBlock name={eq.residual.name} plain={eq.residual.plain}>
          <Residual />
        </EquationBlock>
        <EquationBlock name={eq.attention.name} plain={eq.attention.plain}>
          <GatV2 />
        </EquationBlock>
      </div>
    </Section>
  )
}
