import { create } from 'zustand'
import { confluence } from './lib/graph'

export type AggMode = 'uniform' | 'learned'

type SiteState = {
  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void

  /* hero storm clock, in storm hours: the scene owns time, the DOM reads a throttled copy */
  heroTime: number
  heroPlaying: boolean
  heroSettled: boolean
  heroSeekTo: number | null
  setHeroTime: (t: number) => void
  setHeroSettled: (v: boolean) => void
  replayHero: () => void
  seekHero: (t: number) => void
  consumeSeek: () => number | null

  /* attention scene */
  aggMode: AggMode
  setAggMode: (m: AggMode) => void
  selected: string
  setSelected: (id: string) => void
  hovered: string | null
  setHovered: (id: string | null) => void
  step: number
  setStep: (s: number) => void

  /* cross-section */
  stageM: number
  setStageM: (d: number) => void
}

// ?motion=reduce forces the reduced-motion path, for testing without OS settings.
const prefersReduced =
  typeof window !== 'undefined' &&
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    new URLSearchParams(window.location.search).get('motion') === 'reduce')

// ?hour=N holds the storm at hour N (for inspection and the share image).
const heldHour = (() => {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('hour')
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
})()

export const useSite = create<SiteState>((set, get) => ({
  reducedMotion: prefersReduced,
  setReducedMotion: (v) => set({ reducedMotion: v }),

  // Under reduced motion the storm clock (RiverScene, or StormTimeline without
  // WebGL) moves this to the hold hour as soon as the storm data loads.
  heroTime: heldHour ?? 0,
  heroPlaying: !prefersReduced && heldHour == null,
  heroSettled: prefersReduced || heldHour != null,
  heroSeekTo: null,
  setHeroTime: (t) => set({ heroTime: t }),
  setHeroSettled: (v) => set({ heroSettled: v, heroPlaying: v ? false : get().heroPlaying }),
  replayHero: () => set({ heroSeekTo: 0, heroPlaying: true, heroSettled: false }),
  seekHero: (t) => set({ heroSeekTo: t, heroPlaying: false, heroSettled: true }),
  consumeSeek: () => {
    const t = get().heroSeekTo
    if (t != null) set({ heroSeekTo: null })
    return t
  },

  aggMode: 'learned',
  setAggMode: (m) => set({ aggMode: m }),
  selected: confluence?.id ?? '',
  setSelected: (id) => set({ selected: id }),
  hovered: null,
  setHovered: (id) => set({ hovered: id }),
  step: 0,
  setStep: (s) => set({ step: s }),

  stageM: 0.9,
  setStageM: (d) => set({ stageM: d }),
}))

if (typeof window !== 'undefined') {
  // Mirror the switch onto <html> so CSS can honour ?motion=reduce as well
  // as the media query (index.css).
  const mark = (v: boolean) => {
    if (v) document.documentElement.dataset.motion = 'reduce'
    else delete document.documentElement.dataset.motion
  }
  mark(prefersReduced)
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', (e) => {
      useSite.getState().setReducedMotion(e.matches)
      mark(e.matches)
    })
}
