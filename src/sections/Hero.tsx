import { lazy, Suspense, useEffect, useState } from 'react'
import { hero, site } from '../data/content'
import { FloodVideo } from '../components/FloodVideo'
import { hasWebGL } from '../three/useAdaptiveQuality'

const RiverScene = lazy(() => import('../three/RiverScene'))
// The storm data loads with the timeline, after the headline has painted.
const HeroTimeline = lazy(() => import('../components/HeroTimeline'))

/*
  Act 1. No jargon: the headline, the Wayanad valley in flood, one question,
  and the flood timeline. The four gauge towers answer for four places;
  nothing answers for the rest of the river.
*/
export function Hero() {
  // null until probed. The probe creates a WebGL context, so it runs in the
  // same idle slot that mounts the scene, after the headline has painted.
  const [gl, setGl] = useState<boolean | null>(null)
  const ready = gl !== null
  useEffect(() => {
    let cancelled = false
    let cancelIdle = () => {}
    const go = () => {
      if (!cancelled) setGl(hasWebGL())
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idle = () => {
      if (cancelled) return
      const ric = w.requestIdleCallback
      if (ric) {
        const id = ric(go, { timeout: 1500 })
        cancelIdle = () => w.cancelIdleCallback?.(id)
      } else {
        const id = window.setTimeout(go, 300)
        cancelIdle = () => window.clearTimeout(id)
      }
    }
    // Wait for the first contentful paint before asking for the scene, so
    // three.js is never on the headline's critical path, even when the first
    // frame is slow to reach the screen. The timeout covers browsers without
    // paint timing.
    let po: PerformanceObserver | undefined
    let fallback: number | undefined
    const painted = () => performance.getEntriesByName?.('first-contentful-paint').length > 0
    if (typeof PerformanceObserver === 'undefined' || painted()) idle()
    else {
      const once = () => {
        po?.disconnect()
        window.clearTimeout(fallback)
        idle()
      }
      try {
        po = new PerformanceObserver((list) => {
          if (list.getEntriesByName('first-contentful-paint').length) once()
        })
        po.observe({ type: 'paint', buffered: true })
        fallback = window.setTimeout(once, 4000)
      } catch {
        idle()
      }
    }
    return () => {
      cancelled = true
      po?.disconnect()
      window.clearTimeout(fallback)
      cancelIdle()
    }
  }, [])
  const [h1a, h1b] = hero.headline.split('. ')

  return (
    <header id="top" className="ground-abyss relative overflow-hidden lg:min-h-heroFit">
      <div className="relative h-sceneSm lg:absolute lg:inset-0 lg:h-auto">
        {gl !== false ? (
          ready ? (
            <Suspense fallback={null}>
              <RiverScene />
            </Suspense>
          ) : (
            // Nothing until the probe: an image here would become the page's
            // largest paint and land after the JavaScript; the headline should.
            null
          )
        ) : (
          <div className="h-full w-full lg:ml-auto lg:w-3/5 lg:py-16">
            <FloodVideo className="h-full w-full" />
          </div>
        )}
      </div>

      <div className="pointer-events-none relative z-overlay flex flex-col lg:min-h-heroFit lg:justify-end lg:pl-rail">
        <div className="pointer-events-auto min-w-0 px-gutter pb-8 pt-6 sm:px-8 lg:max-w-lede-wide lg:pb-10 lg:pl-6 lg:pt-24">
          <h1 className="cut-condensed max-w-headline text-display tracking-display text-foam">
            <span className="block font-bold">{h1a}.</span>
            <span className="mt-2 block font-light text-foam">{h1b}</span>
          </h1>
          <p className="mt-6 max-w-lede text-lead text-foam">{hero.question}</p>
          <p className="mt-4 max-w-lede text-body text-foam-soft">{hero.lede}</p>
          <p className="mt-5 max-w-lede text-small text-foam">
            {site.author}
            <span className="text-foam-soft"> — {site.degree}, {site.institution}</span>
          </p>
        </div>
        <div className="pointer-events-auto min-h-timeline min-w-0 border-t-hair border-abyss-line bg-abyss px-gutter pb-5 pt-4 sm:px-8 lg:pl-6 lg:pr-8">
          <Suspense fallback={null}>
            <HeroTimeline drive={gl === false} />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
