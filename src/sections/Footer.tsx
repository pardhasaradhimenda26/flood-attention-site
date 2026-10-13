import { footer, site, tpl } from '../data/content'
import { provenance } from '../data/results'
import { stationOf } from '../lib/stations'
import { WaterMark } from '../components/SectionHead'

export function Footer() {
  const s = stationOf('footer')
  const run = provenance.runs[0] ?? 'none'
  return (
    <footer id="footer" className="ground-abyss relative" aria-labelledby="footer-h">
      <div className="mx-auto max-w-figure px-gutter py-16 sm:px-8 lg:ml-rail lg:pl-10 lg:pr-12 xl:mx-auto">
        <div className="flex flex-wrap items-baseline gap-x-4 border-t-hair border-abyss-line pt-2 text-micro text-foam-soft">
          <span className="flex items-baseline gap-1.5 text-foam">
            <WaterMark className="translate-y-px" />
            <span className="num">{s.elevationM.toFixed(1)} m</span>
          </span>
          <span className="num">t+{s.hours.toFixed(1)} h</span>
          <span>
            station <span className="num">{s.nodeLabel}</span>, outlet. The flood peak arrives here last.
          </span>
        </div>

        <div className="mt-10 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h2 id="footer-h" className="cut-condensed text-h2 tracking-display text-foam">
              {site.author}
            </h2>
            <p className="mt-3 text-body text-foam-soft">
              {site.degree}
              <br />
              {site.institution}
            </p>
            <p className="mt-6 max-w-narrow text-small text-foam-soft">{site.thesisTitle}</p>
          </div>
          <div className="md:col-span-5">
            <p className="text-lead text-foam">{footer.pending}</p>
            <ul className="mt-6 space-y-2 text-small">
              {footer.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-foam" rel="noreferrer">
                    {l.label}: <span className="num">{site.githubHandle}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="num mt-8 text-micro text-foam-soft">{tpl(footer.provenance, { mode: provenance.mode, run })}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
