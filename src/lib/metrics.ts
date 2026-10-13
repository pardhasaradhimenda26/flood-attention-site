import { metrics, type Interval, type Metric } from '../data/results'
import { fmt, fmtValue } from './format'

const byId = new Map(metrics.map((m) => [m.id, m]))

export function metric(id: string): Metric | undefined {
  return byId.get(id)
}

export function isPending(id: string): boolean {
  const m = byId.get(id)
  return !m || m.status === 'pending'
}

/** Parse "+0.017", "−0.014", "17 / 24" → 17, "2–4×" → NaN-safe first number. */
export function parseValue(v: number | string): number {
  if (typeof v === 'number') return v
  return parseFloat(v.replace('−', '-').replace('+', ''))
}

/** Numeric value of a metric, or NaN if pending/non-numeric. */
export function num(id: string): number {
  const m = byId.get(id)
  if (!m || m.status === 'pending') return NaN
  return parseValue(m.value)
}

/** Formatted value, or "pending" for anything not measured. */
export function mv(id: string, withUnit = false): string {
  const m = byId.get(id)
  if (!m || m.status === 'pending') return 'pending'
  const v = fmtValue(m.value)
  if (!withUnit || !m.unit) return v
  return m.unit === '%' || m.unit === '×' ? `${v}${m.unit}` : `${v} ${m.unit}`
}

export function intervalOf(id: string): Interval | undefined {
  const m = byId.get(id)
  return m && m.status !== 'pending' ? m.interval : undefined
}

/** True when a comparison's interval lies wholly on one side of zero. */
export function excludesZero(iv: Interval | undefined | null): boolean {
  return !!iv && (iv.lo > 0 || iv.hi < 0)
}

/** "−2.9% to +17.2%" (or "−0.324 to +0.379" with digits=3, unit=''). */
export function ciText(iv: Interval | undefined | null, unit = '%', digits = 1): string {
  if (!iv) return 'no interval'
  return `${fmt(iv.lo, digits, true)}${unit} to ${fmt(iv.hi, digits, true)}${unit}`
}

/** A metric's interval as words, for prose: "95% interval −2.9% to +17.2%". */
export function ciOf(id: string, digits?: number): string {
  const m = byId.get(id)
  const iv = intervalOf(id)
  if (!m || !iv) return 'pending'
  const unit = m.unit === '%' ? '%' : ''
  return `95% interval ${ciText(iv, unit, digits ?? (unit ? 1 : 3))}`
}
