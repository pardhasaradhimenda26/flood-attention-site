import { lazy, Suspense, useEffect, useState } from 'react'
import { hero, site } from '../data/content'
import { Reading } from '../components/Reading'
import { isPending } from '../lib/metrics'
import { NetworkPlan } from '../components/NetworkPlan'
import { hasWebGL } from '../three/useAdaptiveQuality'
import { useSite } from '../state'
import { waveDuration } from '../lib/graph'
import { HeroGaugeTable } from '../components/HeroGaugeTable'

const RiverScene = lazy(() => import('../three/RiverScene'))

function HeroClock() {
  const t = useSite((s) => s.heroTime)
  const settled = useSite((s) => s.heroSettled)
  const reduced = useSite((s) => s.reducedMotion)
  const seek = useSite((s) => s.seekHero)
  const replay = useSite((s) => s.replayHero)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-foam-soft">
      <label className="flex items-center gap-3">
        <span>{hero.clockLabel}</span>
        <input
          type="range"
          className="range w-36 sm:w-48"
          min={0}
          max={Math.ceil(waveDuration)}
          step={0.5}
          value={Math.min(t, waveDuration)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-valuetext={`${t.toFixed(1)} hours after release`}
        />
      </label>
      <output className="num w-20 text-foam" aria-live="off">
        t+{t.toFixed(1)} h
      </output>
      {settled && !reduced && (
        <button type="button" onClick={replay} className="underline decoration-foam-soft underline-offset-4 hover:decoration-foam">
          {hero.replay}
        </button>
      )}
      {reduced && <span className="basis-full text-micro">{hero.frozen}</span>}
    </div>
  )
}

export function Hero() {
  // null until probed. The probe creates a WebGL context, so it runs in the
  // same idle slot that mounts the scene, after the headline has painted.
  const [gl, setGl] = useState<boolean | null>(null)
  const ready = gl !== null
  useEffect(() => {
    const go = () => setGl(hasWebGL())
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const ric = w.requestIdleCallback
    if (ric) {
      const id = ric(go, { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(go, 300)
    return () => window.clearTimeout(id)
  }, [])
  const [h1a, h1b] = hero.headline.split('. ')

  return (
    <header id="top" className="ground-abyss relative overflow-hidden lg:h-hero lg:min-h-hero">
      <div className="relative h-sceneSm lg:absolute lg:inset-0 lg:h-auto">
        {gl !== false ? (
          ready ? (
            <Suspense fallback={<NetworkPlan mode="wave" still className="h-full w-full opacity-30 lg:ml-auto lg:w-3/5 lg:py-16" />}>
              <RiverScene />
            </Suspense>
          ) : (
            // Placeholder while the scene loads: the plan, still, so the wave's
            // first pass happens once, in 3D.
            <NetworkPlan mode="wave" still className="h-full w-full opacity-30 lg:ml-auto lg:w-3/5 lg:py-16" />
          )
        ) : (
          <div role="img" aria-label={hero.sceneLabel} className="h-full w-full lg:ml-auto lg:w-3/5 lg:py-16">
            <NetworkPlan mode="wave" className="h-full w-full" />
          </div>
        )}
      </div>

      <div className="pointer-events-none relative z-overlay px-gutter pb-10 pt-6 sm:px-8 lg:absolute lg:inset-y-0 lg:left-rail lg:flex lg:flex-col lg:justify-end lg:pb-14 lg:pl-6">
        <div className="pointer-events-auto">
          <h1 className="cut-condensed max-w-headline text-display tracking-display text-foam">
            <span className="block font-bold">{h1a}.</span>
            <span className="mt-2 block font-light text-foam">{h1b}</span>
          </h1>
          <p className="mt-6 max-w-lede text-body text-foam-soft">{hero.lede}</p>
          <p className="mt-5 max-w-lede text-small text-foam">
            {site.author}
            <span className="text-foam-soft"> — {site.degree}, {site.institution}</span>
          </p>
        </div>
        <div className="pointer-events-auto mt-9 grid max-w-figure gap-6 sm:grid-cols-3 sm:gap-8">
          {hero.readings.map((r) => (
            <Reading key={r.metric} id={r.metric} caption={(isPending(r.metric) && 'pendingCaption' in r && r.pendingCaption) || r.caption} />
          ))}
        </div>
      </div>

      <div className="relative z-overlay px-gutter pb-8 sm:px-8 lg:absolute lg:right-8 lg:top-6 lg:max-w-panel lg:px-0 lg:pb-0">
        <HeroClock />
        <HeroGaugeTable />
      </div>
    </header>
  )
}
