import { provenance, wayanadRollout } from '../data/results'
import { site, tpl, wayanadCopy } from '../data/content'
import { claims } from '../data/claims'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { ClaimBlock } from '../components/ClaimBlock'
import { StatusFigure } from '../components/StatusFigure'
import { RolloutChart } from '../components/RolloutChart'

/*
  Act 4 opens on the real river: the first numbers from the Wayanad HEC-RAS
  2D port. Everything here is qualified at best (a first run on model output),
  the attention result sits beside its confound baseline at equal size, and a
  dated line names the dataset version, the plan and the run.
*/
export function Wayanad() {
  const w = provenance.wayanad
  const c = wayanadCopy
  return (
    <Section id="wayanad" ground="paper">
      <SectionHead section="wayanad" id="wayanad-h">
        {c.heading}
      </SectionHead>
      <p className="max-w-measure text-lead text-ink">{c.intro}</p>
      {w && (
        <p className="num mt-4 max-w-measure text-micro text-ink-soft">
          {tpl(c.dated, {
            date: w.runDate,
            archive: w.archive,
            sha: w.archiveSha256.slice(0, 12),
            run: w.runId,
            hash: w.configHash ?? '—',
            hero: w.heroEvent,
            train: `${w.events.train[0]}–${w.events.train[w.events.train.length - 1]}`,
            test: `${w.events.test[0]}–${w.events.test[w.events.test.length - 1]}`,
          })}{' '}
          <a href={`${site.repo}/blob/main/WAYANAD_FINDINGS.md`} className="font-sans text-ink" rel="noreferrer">
            {c.findingsLink}
          </a>
        </p>
      )}

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <ClaimBlock claim={claims.wyPort} />
          <ClaimBlock claim={claims.wyLag} />
          <StatusFigure id="wy_travel_h" size="compact" caption={c.travelCaption} />
        </div>
        <div className="min-w-0 space-y-8">
          <ClaimBlock claim={claims.wyAccuracy} />
          <StatusFigure id="wy_gat_vs_gcn" size="reading" caption={c.accuracyCaption} />
        </div>
      </div>

      <div className="mt-16 border-t-2 border-ink pt-5">
        <ClaimBlock claim={claims.wyAttention} />
        <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
          <StatusFigure id="wy_att_tt_r" size="reading" caption={c.attCaption} className="min-w-0" />
          <StatusFigure id="wy_att_confound" size="reading" caption={c.confoundCaption} className="min-w-0" />
          <StatusFigure id="wy_att_seed_r" size="reading" caption={c.seedCaption} className="min-w-0" />
        </div>
      </div>

      <div className="mt-16">
        <h3 className="text-h3">{c.rolloutHeading}</h3>
        <p className="mb-6 mt-2 max-w-measure text-small text-ink-soft">{tpl(c.rolloutIntro, { steps: wayanadRollout?.steps.length ?? 0 })}</p>
        <RolloutChart data={wayanadRollout} scope={c.rolloutScope} />
      </div>

      <ClaimBlock claim={claims.wyValidation} className="mt-14" />
    </Section>
  )
}
