import type { ReactNode } from 'react'
import type { SectionKey } from '../lib/stations'
import { ContourField } from './ContourField'

/** A section on one of the two grounds, offset for the stage rail on wide screens. */
export function Section({
  id,
  ground,
  children,
  contours = true,
  className = '',
}: {
  id: SectionKey
  ground: 'paper' | 'abyss'
  children: ReactNode
  contours?: boolean
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`ground-${ground} relative overflow-hidden ${className}`}>
      {contours && <ContourField section={id} tone={ground} className={ground === 'paper' ? 'opacity-70' : 'opacity-40'} />}
      <div className="relative mx-auto max-w-figure px-gutter py-20 sm:px-8 md:py-28 lg:ml-rail lg:pl-10 lg:pr-12 xl:mx-auto">
        {children}
      </div>
    </section>
  )
}
