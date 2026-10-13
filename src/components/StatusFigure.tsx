import type { Status } from '../data/results'
import { metric } from '../lib/metrics'
import { fmtValue, minus } from '../lib/format'
import { STATUS_WORD, unitText } from '../lib/status'

/*
  The evidential-status language. Every quantitative claim carries its status
  in the rule beneath the figure and in words, never in colour alone:

    verified   full-strength figure, solid rule, "Verified"
    qualified  full-strength figure, dashed rule, the qualifier beside it
    pending    reduced-weight "pending" on a hatched field, no rule

  A qualified figure and its qualifier are one visual unit. Nothing here sits
  in a footnote.
*/

const SIZE = {
  figure: 'text-figure',
  reading: 'text-reading',
  compact: 'text-h3',
} as const

export function StatusFigure({
  id,
  caption,
  size = 'reading',
  className = '',
}: {
  id: string
  caption?: string
  size?: keyof typeof SIZE
  className?: string
}) {
  const m = metric(id)
  const status: Status = m?.status ?? 'pending'
  return (
    <div data-status={status} className={className}>
      <div className="inline-flex max-w-full flex-col">
        {status === 'pending' ? (
          <div className={`num ${SIZE[size]} pending-hatch px-2 font-light tracking-tightish text-fg-soft`}>pending</div>
        ) : (
          <div className={`num ${SIZE[size]} tracking-tightish text-fg`}>
            {fmtValue(m!.value)}
            {m!.unit && <span className="text-lead text-fg-soft">{unitText(m!)}</span>}
          </div>
        )}
        {status !== 'pending' && (
          <span
            aria-hidden="true"
            className={`mt-2 block border-t-2 border-fg ${status === 'qualified' ? 'border-dashed' : 'border-solid'}`}
          />
        )}
      </div>
      <p className="mt-2 max-w-caption text-small text-fg">
        <span className="font-semibold">{STATUS_WORD[status]}</span>
        {status === 'qualified' && m?.qualifier ? <span>: {minus(m.qualifier)}</span> : null}
      </p>
      {caption && <p className="mt-1 max-w-caption text-small text-fg-soft">{caption}</p>}
    </div>
  )
}

/**
 * A figure on one line, for counterweights and comparisons set side by side:
 * label, value with its rule, status word and qualifier.
 */
export function StatusLine({ id, label, className = '' }: { id: string; label?: string; className?: string }) {
  const m = metric(id)
  const status: Status = m?.status ?? 'pending'
  return (
    <p data-status={status} className={`text-small text-fg ${className}`}>
      <span className="text-fg-soft">{label ?? m?.label}: </span>
      {status === 'pending' ? (
        <span className="pending-hatch px-1 font-light text-fg-soft">pending</span>
      ) : (
        <span
          className={`num border-b-2 border-fg pb-px font-medium ${status === 'qualified' ? 'border-dashed' : 'border-solid'}`}
        >
          {fmtValue(m!.value)}
          {unitText(m!)}
        </span>
      )}{' '}
      <span className="font-semibold">{STATUS_WORD[status].toLowerCase()}</span>
      {status === 'qualified' && m?.qualifier ? <span>: {minus(m.qualifier)}</span> : null}
    </p>
  )
}
