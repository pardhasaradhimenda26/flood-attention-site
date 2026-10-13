import { metric } from '../lib/metrics'
import { fmtValue } from '../lib/format'

/*
  A number set as a gauge reading: a short staff segment with ticks, the value
  in Plex Mono, the caption in Archivo. Pending metrics are hatched and say so.
*/
export function Reading({ id, caption }: { id: string; caption: string }) {
  const m = metric(id)
  const pending = !m || m.status === 'pending'
  return (
    <div className={`flex gap-3 ${pending ? 'pending-hatch' : ''}`}>
      <svg width="10" height="64" viewBox="0 0 10 64" aria-hidden="true" className="mt-1 shrink-0 text-fg-soft">
        <line x1="1" y1="0" x2="1" y2="64" stroke="currentColor" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="1" x2={i % 4 === 0 ? 9 : 5} y1={i * 8} y2={i * 8} stroke="currentColor" />
        ))}
      </svg>
      <div>
        <div className="num text-reading tracking-tightish text-fg">
          {pending ? (
            <span className="text-fg-soft">pending</span>
          ) : (
            <>
              {fmtValue(m.value)}
              {m.unit && <span className="text-lead text-fg-soft">{m.unit === '%' ? '%' : ` ${m.unit}`}</span>}
            </>
          )}
        </div>
        <p className="mt-1 max-w-caption text-small text-fg-soft">{caption}</p>
      </div>
    </div>
  )
}
