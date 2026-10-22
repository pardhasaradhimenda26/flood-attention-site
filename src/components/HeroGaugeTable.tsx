import { hero } from '../data/content'
import { W, dateAt, inflowPeakHour, lagHours, peakOf, stormGauges } from '../lib/storm'
import { fmt } from '../lib/format'

/** Static equivalent of the hero scene: the flood at each gauge, as a table. */
export function HeroGaugeTable() {
  if (!stormGauges.length) return null
  return (
    <details className="mt-3 text-small text-foam-soft">
      <summary className="cursor-pointer select-none text-foam-soft hover:text-foam">{hero.tableToggle}</summary>
      <table className="mt-3 w-full max-w-panel text-left">
        <caption className="pb-2 text-left text-micro">
          {hero.tableCaption} Inflow from upstream peaked at <span className="num">{fmt(Math.max(...W.inflowM3s), 0)} m³/s</span> on{' '}
          <span className="num">{dateAt(inflowPeakHour)}</span>; the outlet peaked <span className="num">{lagHours} h</span> later.
        </caption>
        <thead>
          <tr className="border-b-hair border-abyss-line text-micro">
            <th scope="col" className="py-1 pr-3 font-normal">Gauge</th>
            <th scope="col" className="py-1 pr-3 font-normal">Place</th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">km downstream</th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">Peak depth</th>
            <th scope="col" className="py-1 text-right font-normal">Peak at</th>
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
                <td className="py-1 pr-3">
                  {g.place}
                  <span className="block text-micro">
                    {g.section.admin}; <span className="num">{fmt(g.section.lat, 3)}° N, {fmt(g.section.lon, 3)}° E</span>
                  </span>
                </td>
                <td className="num py-1 pr-3 text-right">{fmt(g.section.s_m / 1000, 1)}</td>
                <td className="num py-1 pr-3 text-right">{fmt(p.depthM, 2)} m</td>
                <td className="num py-1 text-right">{dateAt(p.hour)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}
