import { AnimatePresence, m } from 'framer-motion'
import { attention } from '../data/network'
import { attentionCopy, tpl } from '../data/content'
import {
  confluences,
  incomingAll,
  incomingRouting,
  learnedRange,
  nodeById,
  roleText,
  selfWeight,
  weightOf,
} from '../lib/graph'
import { fmt } from '../lib/format'
import { useSite } from '../state'

/*
  Per-edge contributions into the focused node, on a chart-paper plate. In
  learned mode the bars are magenta — the attention signal — and each value
  carries its seed range. In uniform mode nothing is learned, so nothing is
  magenta.
*/
export function AttentionPanel() {
  const selected = useSite((s) => s.selected)
  const hovered = useSite((s) => s.hovered)
  const mode = useSite((s) => s.aggMode)
  const step = useSite((s) => s.step)
  const reduced = useSite((s) => s.reducedMotion)
  const focus = hovered ?? selected
  const node = nodeById.get(focus)

  if (!node) {
    return (
      <div className="ground-paper p-5 text-small text-ink-soft">
        Select a node in the network, or press an arrow key with the scene focused.
      </div>
    )
  }

  const learned = mode === 'learned'
  const rows = (incomingAll.get(node.id) ?? [])
    .map((e) => {
      const s = nodeById.get(e.source)!
      return { e, s, w: weightOf(e, mode, step), range: learned ? learnedRange(e.id, step) : null }
    })
    .sort((a, b) => (learned ? b.w - a.w : a.e.hops - b.e.hops || a.e.travelTimeHours - b.e.travelTimeHours))
  const self = selfWeight(node.id, mode, step)
  const max = Math.max(self, ...rows.map((r) => r.w), 0.01)
  const isConf = confluences.some((c) => c.id === node.id)
  const branchSums = isConf
    ? (incomingRouting.get(node.id) ?? []).map((r) => {
        const br = nodeById.get(r.source)!.branch
        const sum = rows.filter((x) => x.s.branch === br).reduce((a, x) => a + x.w, 0)
        return { br, sum, tt: r.travelTimeHours }
      })
    : []

  return (
    <div className="ground-paper flex h-full flex-col p-5 sm:p-6">
      <div aria-live="polite">
        <h3 className="text-h3">
          {tpl(attentionCopy.panelTitle, { label: '' })}
          <span className="num">{node.label}</span>
        </h3>
        <p className="mt-1 text-small text-ink-soft">
          {isConf ? 'confluence' : roleText(node.gaugeRole)} · <span className="num">{node.elevationM.toFixed(1)} m</span> ·{' '}
          <span className="num">{node.drainageAreaKm2.toFixed(1)} km²</span> drains here
        </p>
      </div>

      {branchSums.length > 1 && (
        <p className="mt-3 border-l-2 border-ink pl-3 text-small text-ink">
          {branchSums.map((b, i) => (
            <span key={b.br}>
              {i > 0 ? '; ' : ''}
              {b.br === 'main' ? 'main stem' : `tributary ${b.br.replace('trib', '').toUpperCase()}`}{' '}
              <span className="num">{fmt(b.sum, 2)}</span> of the weight, last reach <span className="num">{fmt(b.tt, 1)} h</span>
            </span>
          ))}
          .
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
      <table className="w-full text-small">
        <caption className="sr-only">
          Weight on each incoming message at {node.label}, {learned ? 'learned attention' : 'uniform aggregation'}, rollout hour {step + 1}
        </caption>
        <thead>
          <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
            <th scope="col" className="py-1 pr-2 font-normal">From</th>
            <th scope="col" className="py-1 pr-2 text-right font-normal">Hops</th>
            <th scope="col" className="py-1 pr-2 text-right font-normal">Travel, h</th>
            <th scope="col" className="py-1 pr-2 text-right font-normal">Area, km²</th>
            <th scope="col" className="py-1 font-normal">Weight</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map(({ e, s, w, range }) => (
              <m.tr
                key={e.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
                className="border-b-hair border-paper-line"
              >
                <th scope="row" className="num py-1.5 pr-2 text-left font-normal text-ink">
                  {s.label}
                </th>
                <td className="num py-1.5 pr-2 text-right">{e.hops}</td>
                <td className="num py-1.5 pr-2 text-right">{fmt(e.travelTimeHours, 1)}</td>
                <td className="num py-1.5 pr-2 text-right">{fmt(s.drainageAreaKm2, 0)}</td>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <svg width="64" height="10" aria-hidden="true" className="shrink-0">
                      {range && <title>{`seed range ${fmt(range[0], 2)}–${fmt(range[1], 2)}`}</title>}
                      <rect x="0" y="3" width="64" height="4" fill="var(--paper-inset)" />
                      {range && (
                        <rect x={(range[0] / max) * 64} y="1" width={Math.max(1, ((range[1] - range[0]) / max) * 64)} height="8" fill="var(--signal)" opacity="0.18" />
                      )}
                      <rect x="0" y="3" width={(w / max) * 64} height="4" fill={learned ? 'var(--signal)' : 'var(--ink-soft)'} />
                    </svg>
                    <span className={`num ${learned ? 'text-signal' : 'text-ink'}`}>{fmt(w, 3)}</span>
                    {range && (
                      <span className="sr-only">
                        , seeds {fmt(range[0], 2)} to {fmt(range[1], 2)}
                      </span>
                    )}
                  </div>
                </td>
              </m.tr>
            ))}
          </AnimatePresence>
          <tr>
            <th scope="row" className="py-1.5 pr-2 text-left font-normal text-ink-soft" colSpan={4}>
              {attentionCopy.selfRow}
            </th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <svg width="64" height="10" aria-hidden="true" className="shrink-0">
                  <rect x="0" y="3" width="64" height="4" fill="var(--paper-inset)" />
                  <rect x="0" y="3" width={(self / max) * 64} height="4" fill="var(--ink-soft)" />
                </svg>
                <span className="num text-ink-soft">{fmt(self, 3)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      {rows.length === 0 && <p className="mt-3 text-small text-ink-soft">A headwater: no messages arrive here, only its own state.</p>}

      <p className="mt-4 text-micro text-ink-soft">
        {learned && attention ? tpl(attentionCopy.learnedNote, { run: attention.run }) : attentionCopy.uniformNote}
      </p>

    </div>
  )
}
