import { metrics, type Metric } from '../data/results'
import { fmtValue } from './format'

const byId = new Map(metrics.map((m) => [m.id, m]))

export function metric(id: string): Metric | undefined {
  return byId.get(id)
}

export function isPending(id: string): boolean {
  const m = byId.get(id)
  return !m || m.status === 'pending'
}

/** Numeric value of a metric (handles "+0.017", "−0.014"), or NaN if pending/non-numeric. */
export function num(id: string): number {
  const m = byId.get(id)
  if (!m || m.status === 'pending') return NaN
  if (typeof m.value === 'number') return m.value
  return parseFloat(m.value.replace('−', '-').replace('+', ''))
}

/** Formatted value, or "pending" for anything not measured. */
export function mv(id: string, withUnit = false): string {
  const m = byId.get(id)
  if (!m || m.status === 'pending') return 'pending'
  const v = fmtValue(m.value)
  if (!withUnit || !m.unit) return v
  return m.unit === '%' || m.unit === '×' ? `${v}${m.unit}` : `${v} ${m.unit}`
}
