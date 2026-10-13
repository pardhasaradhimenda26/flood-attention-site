import type { ReactNode } from 'react'
import { stationOf, type SectionKey } from '../lib/stations'

/** Engineering water-surface symbol. */
export function WaterMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 12" className={`inline-block h-3 w-3.5 ${className}`} aria-hidden="true">
      <path d="M1 1.5h12L7 10.5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 12h7M5 14h4" stroke="currentColor" strokeWidth="1" transform="translate(0 -1)" />
    </svg>
  )
}

/*
  A section opens on a waterline: a hairline carrying the water-surface mark,
  the station's elevation and the hour the flood peak reaches it. Then the
  heading. The numbers are data from network.ts, not decoration.
*/
export function SectionHead({ section, children, id }: { section: SectionKey; children: ReactNode; id: string }) {
  const s = stationOf(section)
  return (
    <div className="mb-10 md:mb-14">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t-hair border-rule pt-2 text-micro text-fg-soft">
        <span className="flex items-baseline gap-1.5">
          <WaterMark className="translate-y-px text-fg" />
          <span className="num text-fg">{s.elevationM.toFixed(1)} m</span>
        </span>
        <span className="num">t+{s.hours.toFixed(1)} h</span>
        <span>
          station <span className="num">{s.nodeLabel}</span>
          {s.note ? `, ${s.note}` : ''}
        </span>
      </div>
      <h2 id={id} className="cut-condensed mt-5 max-w-headline text-h2 tracking-display">
        {children}
      </h2>
    </div>
  )
}
