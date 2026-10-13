import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Renders children only once the placeholder comes near the viewport. */
export function LazyMount({ children, placeholder, className, margin = '400px' }: { children: ReactNode; placeholder?: ReactNode; className?: string; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || on) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [on, margin])
  return (
    <div ref={ref} className={className}>
      {on ? children : placeholder}
    </div>
  )
}
