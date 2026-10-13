import type { Metric, Status } from '../data/results'
import { minus } from './format'

export const STATUS_WORD: Record<Status, string> = {
  verified: 'Verified',
  qualified: 'Qualified',
  pending: 'Pending',
}

export function unitText(m: Metric): string {
  if (!m.unit) return ''
  return m.unit === '%' || m.unit === '×' ? m.unit : ` ${m.unit}`
}

/** "Verified", or "Qualified: <qualifier>", or "Pending". The words a screen reader hears. */
export function statusSentence(m: Metric | undefined): string {
  if (!m || m.status === 'pending') return 'Pending: not yet measured.'
  if (m.status === 'qualified') return `Qualified: ${minus(m.qualifier ?? '')}.`
  return m.derivation === 'read' ? 'Verified, read from RESULTS.md.' : 'Verified, recomputed from the run outputs.'
}
