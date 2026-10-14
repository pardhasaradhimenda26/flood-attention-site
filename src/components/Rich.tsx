import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TERM_RE, resolveTerm, type Term as TermDef } from '../data/glossary'
import { tpl } from '../data/content'

/*
  Inline glossary. A marked term is a button with a dotted underline; hover,
  keyboard focus or a tap shows its one plain sentence beneath, styled as a
  survey label (paper ground, hairline rule, square corners). Escape closes
  it. The sentence is linked with aria-describedby, so a screen reader reads
  it with the term.
*/
export function Term({ term, children }: { term: TermDef; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const id = useId()
  const tip = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (!open || !tip.current) return
    const r = tip.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    if (r.right > vw - 8) setShift(vw - 8 - r.right)
    else if (r.left < 8) setShift(8 - r.left)
  }, [open])
  useEffect(() => {
    if (!open) setShift(0)
  }, [open])

  return (
    <span className="relative inline">
      <button
        type="button"
        className="term inline cursor-help border-0 bg-transparent p-0 text-inherit"
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        {children}
      </button>
      <span
        ref={tip}
        id={id}
        role="tooltip"
        className={`ground-paper absolute left-0 top-full z-rail mt-1 w-max max-w-tip border-hair border-ink px-2.5 py-1.5 text-left text-small font-normal normal-case tracking-normal text-ink ${open ? 'block' : 'hidden'}`}
        style={{ transform: shift ? `translateX(${shift}px)` : undefined }}
      >
        <span className="font-semibold">{term.term}.</span> {term.plain}
      </span>
    </span>
  )
}

/** Render copy: fill {placeholders}, then turn [[terms]] into glossary controls. */
export function Rich({ text, vars }: { text: string; vars?: Record<string, string | number> }) {
  const s = vars ? tpl(text, vars) : text
  const out: ReactNode[] = []
  let last = 0
  for (const m of s.matchAll(TERM_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(s.slice(last, at))
    const def = resolveTerm(m[1], m[2])
    out.push(def ? <Term key={at} term={def}>{m[1]}</Term> : m[1])
    last = at + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return <Fragment>{out}</Fragment>
}
