import { lazy, startTransition, Suspense, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig } from 'framer-motion'
import { Hero } from './sections/Hero'
import { StageRuler } from './components/StageRuler'
import { useSite } from './state'

const BelowFold = lazy(() => import('./sections/BelowFold'))
const motionFeatures = () => import('./motionFeatures').then((m) => m.default)

export default function App() {
  const [rest, setRest] = useState(false)
  // The store merges the OS setting with ?motion=reduce, so framer-motion
  // follows the same switch as the scenes and the CSS.
  const reduced = useSite((s) => s.reducedMotion)
  useEffect(() => {
    startTransition(() => setRest(true))
  }, [])
  return (
    <LazyMotion features={motionFeatures} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
        <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-rail bg-paper px-3 py-2 text-ink">
          Skip to content
        </a>
        <StageRuler />
        <Hero />
        {rest && (
          <Suspense fallback={<div id="main" className="ground-paper h-hero" />}>
            <BelowFold />
          </Suspense>
        )}
      </MotionConfig>
    </LazyMotion>
  )
}
