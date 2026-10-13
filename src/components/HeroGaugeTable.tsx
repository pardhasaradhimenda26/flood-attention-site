import { hero } from '../data/content'
import { gaugeName, gauges, pulsesAt, peakIntensity, roleText } from '../lib/graph'
import { fmt } from '../lib/format'

/** Static equivalent of the hero scene: when and how strongly each pulse reaches each gauge. */
export function HeroGaugeTable() {
  return (
    <details className="mt-3 text-small text-foam-soft">
      <summary className="cursor-pointer select-none text-foam-soft hover:text-foam">
        Read the wave as a table
      </summary>
      <table className="mt-3 w-full max-w-panel text-left">
        <caption className="pb-2 text-left text-micro">{hero.tableSummary}</caption>
        <thead>
          <tr className="border-b-hair border-abyss-line text-micro">
            <th scope="col" className="py-1 pr-3 font-normal">Gauge</th>
            <th scope="col" className="py-1 pr-3 font-normal">From</th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">Peak at</th>
            <th scope="col" className="py-1 text-right font-normal">Relative height</th>
          </tr>
        </thead>
        <tbody>
          {gauges.flatMap((g) =>
            pulsesAt.get(g.id)!.map((p, i) => (
              <tr key={g.id + p.head} className="border-b-hair border-abyss-line">
                <th scope="row" className="py-1 pr-3 font-normal text-foam">
                  {i === 0 ? (
                    <>
                      <span className="num">{gaugeName.get(g.id)}</span> {roleText(g.gaugeRole)}
                    </>
                  ) : null}
                </th>
                <td className="num py-1 pr-3">{p.head.split('_').slice(-2).join(' ')}</td>
                <td className="num py-1 pr-3 text-right">t+{fmt(p.arrival, 1)} h</td>
                <td className="num py-1 text-right">{fmt(peakIntensity(p), 2)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </details>
  )
}
