import { useEffect, useRef, useState } from 'react'

/** Element width in CSS pixels, so SVG text renders at its true size. */
export function useMeasure<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null)
  // Never start wider than the screen: a chart's first render sets its
  // container's min-content width, and an over-wide start would hold a grid
  // column open on a phone.
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' || !window.innerWidth ? initial : Math.max(240, Math.min(initial, window.innerWidth - 32)),
  )
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
