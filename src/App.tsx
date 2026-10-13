import { lazy, startTransition, Suspense, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig } from 'framer-motion'
import { Hero } from './sections/Hero'
import { StageRuler } from './components/StageRuler'

const BelowFold = lazy(() => import('./sections/BelowFold'))
const motionFeatures = () => import('./motionFeatures').then((m) => m.default)

export default function App() {
  const [rest, setRest] = useState(false)
  useEffect(() => {
    startTransition(() => setRest(true))
  }, [])
  return (
    <LazyMotion features={motionFeatures} strict>
      <MotionConfig reducedMotion="user">
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
