import { approach } from '../data/content'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { Continuity, EquationBlock, GatV2, Muskingum, Residual } from '../components/EquationBlock'
import { RiverToGraph } from '../components/RiverToGraph'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'

const STEP_CLAIMS = [claims.graph, claims.passing, claims.physics, claims.attending]

export function Approach() {
  const eq = approach.equations
  return (
    <Section id="approach" ground="paper">
      <SectionHead section="approach" id="approach-h">
        {approach.heading}
      </SectionHead>
      <div className="mb-16">
        <RiverToGraph />
      </div>
      <p className="max-w-measure text-lead text-ink">{approach.intro}</p>

      {/* Act 3 is the one genuine sequence on the page, so it is numbered. */}
      <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {approach.steps.map((s, i) => (
          <li key={s.title} className="grid min-w-0 grid-cols-lead gap-x-5">
            <span className="num text-h3 leading-none text-ink-soft" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <h3 className="text-small font-semibold text-ink-soft">{s.title}</h3>
              <ClaimBlock claim={STEP_CLAIMS[i]} className="mt-2" />
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
