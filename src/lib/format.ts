const MINUS = '−'

/** Typographic minus for numbers and numeric strings. */
export function minus(s: string): string {
  return s.replace(/(^|[\s(])-(?=\d|\.)/g, `$1${MINUS}`)
}

export function fmt(n: number, digits = 2, signed = false): string {
  if (!Number.isFinite(n)) return '—'
  const s = Math.abs(n).toFixed(digits)
  const sign = n < 0 ? MINUS : signed ? '+' : ''
  return sign + s
}

export function fmtValue(v: number | string, digits?: number): string {
  if (typeof v === 'string') return minus(v)
  if (digits != null) return fmt(v, digits)
  if (Number.isInteger(v)) return String(v)
  return minus(String(v))
}

export function hours(h: number, digits = 1): string {
  return `${h.toFixed(digits)} h`
}

export function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x
}
