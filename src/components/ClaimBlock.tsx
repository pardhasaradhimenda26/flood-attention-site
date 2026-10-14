import type { Claim } from '../data/claims'
import { STATUS_WORD } from '../lib/status'
import { Rich } from './Rich'

/*
  A claim in two layers, both always visible: the plain line above, larger, in
  the display face; the technical line directly beneath, smaller, in the data
  face, carrying its status rule — solid verified, dashed qualified, hatched
  pending — and the status in words. The reader picks a depth by where the eye
  stops. No tab, no accordion.
*/
export function ClaimBlock({ claim, size = 'lead', className = '' }: { claim: Claim; size?: 'lead' | 'h3'; className?: string }) {
  const s = claim.status
  return (
    <div data-claim={claim.id} data-status={s} className={`max-w-measure ${className}`}>
      <p className={`cut-semi ${size === 'h3' ? 'text-h3' : 'text-lead'} font-semibold leading-snug text-fg`}>
        <Rich text={claim.plain} />
      </p>
      <p
        className={`mt-2 border-l-2 border-fg pl-3 font-mono text-small leading-relaxed text-fg-soft ${
          s === 'qualified' ? 'border-dashed' : s === 'pending' ? 'pending-hatch border-fg-soft' : 'border-solid'
        }`}
      >
        <span className="font-sans font-semibold text-fg">{STATUS_WORD[s]}.</span> <Rich text={claim.technical} />
      </p>
    </div>
  )
}
