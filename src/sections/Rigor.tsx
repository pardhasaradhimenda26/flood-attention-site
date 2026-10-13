import { rigor, tpl } from '../data/content'
import { mv } from '../lib/metrics'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'

export function Rigor() {
  return (
    <Section id="rigor" ground="paper" contours={false} className="bg-paper-inset">
      <SectionHead section="rigor" id="rigor-h">
        {rigor.heading}
      </SectionHead>
      <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
        {rigor.items.map((it) => (
          <div key={it.title} className="border-t-hair border-ink pt-3">
            <dt className="text-body font-semibold text-ink">{it.title}</dt>
            <dd className="mt-2 max-w-narrow text-small text-ink-soft">{tpl(it.body, { tests: mv('tests_passing'), untrained: mv('trap_untrained') })}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
