/* Pure chart arithmetic, kept out of the components so it can be tested. */

/** Log-scale ticks: powers of two from 0.25 to 32 that fall inside [lo, hi]. */
export function logTicks(lo: number, hi: number): number[] {
  return [0.25, 0.5, 1, 2, 4, 8, 16, 32].filter((t) => t >= lo && t <= hi)
}

/**
 * Push direct labels apart so none sits closer than `gap` px to the one above.
 * Input in any order; output sorted top to bottom, each label moved down only.
 */
export function spreadLabels<T>(items: { item: T; y: number }[], gap = 14): { item: T; y: number }[] {
  const out = items.map((d) => ({ ...d })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap
  return out
}
