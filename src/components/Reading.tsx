import { StatusFigure } from './StatusFigure'

/*
  A number set as a gauge reading: a short staff segment with ticks beside the
  figure. The figure itself carries its evidential status (StatusFigure).
*/
export function Reading({ id, caption }: { id: string; caption: string }) {
  return (
    <div className="flex gap-3">
      <svg width="10" height="64" viewBox="0 0 10 64" aria-hidden="true" className="mt-1 shrink-0 text-fg-soft">
        <line x1="1" y1="0" x2="1" y2="64" stroke="currentColor" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="1" x2={i % 4 === 0 ? 9 : 5} y1={i * 8} y2={i * 8} stroke="currentColor" />
        ))}
      </svg>
      <StatusFigure id={id} caption={caption} size="reading" className="min-w-0" />
    </div>
  )
}
