import { hero } from '../data/content'
import { stormEvent } from '../data/network'
import { lagHours, peakOf, rainPeakHour, stormGauges, upstreamRain } from '../lib/storm'
import { fmt } from '../lib/format'

/** Static equivalent of the hero scene: the storm at each gauge, as a table. */
export function HeroGaugeTable() {
  if (!stormEvent) return null
  const rainTotal = upstreamRain.reduce((a, b) => a + b, 0)
  return (
    <details className="mt-3 text-small text-foam-soft">
      <summary className="cursor-pointer select-none text-foam-soft hover:text-foam">{hero.tableToggle}</summary>
      <table className="mt-3 w-full max-w-panel text-left">
        <caption className="pb-2 text-left text-micro">
          {hero.tableCaption} Rain on the headwaters: <span className="num">{fmt(rainTotal, 0)} mm</span> in total, heaviest at hour{' '}
          <span className="num">{rainPeakHour}</span>; the outlet peaked <span className="num">{lagHours} h</span> later.
        </caption>
        <thead>
          <tr className="border-b-hair border-abyss-line text-micro">
            <th scope="col" className="py-1 pr-3 font-normal">Gauge</th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">Depth at hour 0</th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">Peak depth</th>
            <th scope="col" className="py-1 text-right font-normal">Peak at hour</th>
          </tr>
        </thead>
        <tbody>
          {stormGauges.map((g) => {
            const p = peakOf(g.id)
            return (
              <tr key={g.id} className="border-b-hair border-abyss-line">
                <th scope="row" className="py-1 pr-3 font-normal text-foam">
                  <span className="num">{g.name}</span> {g.role}
                </th>
                <td className="num py-1 pr-3 text-right">{fmt(stormEvent!.nodes[g.id].depthM[0], 2)} m</td>
                <td className="num py-1 pr-3 text-right">{fmt(p.depthM, 2)} m</td>
                <td className="num py-1 text-right">{p.hour}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}
