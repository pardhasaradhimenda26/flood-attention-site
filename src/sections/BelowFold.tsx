import { startTransition, useEffect, useState } from 'react'
import { Verdict } from './Verdict'
import { Wayanad } from './Wayanad'
import { Problem } from './Problem'
import { Approach } from './Approach'
import { Attention } from './Attention'
import { Dataset } from './Dataset'
import { Findings } from './Findings'
import { Results } from './Results'
import { Rigor } from './Rigor'
import { Footer } from './Footer'

/*
  Everything after the hero, in its own chunk. Sections mount one per idle
  slot inside transitions, so neither rendering nor the DOM commit becomes a
  long task while the hero comes up. A #hash link mounts everything at once.
*/
// Act 2: Problem. Act 3: Approach (the river becomes a graph), Attention, Dataset.
// Act 4: Wayanad (the real river, modelled), then the synthetic Verdict,
// Findings and Results. Then rigour and the footer.
const SECTIONS = [Problem, Approach, Attention, Dataset, Wayanad, Verdict, Findings, Results, Rigor, Footer]

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }

export default function BelowFold() {
  const hash = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.slice(1)) : ''
  const [count, setCount] = useState(hash ? SECTIONS.length : 1)

  useEffect(() => {
    if (count >= SECTIONS.length) return
    const w = window as IdleWindow
    const next = () => startTransition(() => setCount((c) => c + 1))
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(next, { timeout: 600 })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(next, 50)
    return () => window.clearTimeout(id)
  }, [count])

  // The browser tried to honour #hash before these sections existed.
  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView()
  }, [hash])

  const shown = SECTIONS.slice(0, count)
  const footer = shown.includes(Footer)
  return (
    <>
      <main id="main">
        {shown
          .filter((S) => S !== Footer)
          .map((S, i) => (
            <S key={i} />
          ))}
      </main>
      {footer && <Footer />}
    </>
  )
}
