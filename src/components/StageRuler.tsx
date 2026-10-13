import { useEffect, useRef, useState } from 'react'
import { profile, profileBottom, profileTop, stations } from '../lib/stations'
import { WaterMark } from './SectionHead'

/*
  Scroll position as water stage. A staff gauge down the left margin, scaled
  to the main stem's real long profile: headwater at the top, outlet at the
  bottom, a tick at every cross-section. Reading the page moves the water
  level down the staff, and the readout gives the elevation and the hour at
  which the flood peak reaches that point.
*/

const TOP = 7 // % of rail height reserved above the profile
const BOT = 9

function yOf(elevationM: number) {
  const f = (profileTop - elevationM) / (profileTop - profileBottom)
  return TOP + f * (100 - TOP - BOT)
}

export function StageRuler() {
  const [reading, setReading] = useState({ elev: profileTop, hours: 0 })
  const raf = useRef(0)

  useEffect(() => {
    const update = () => {
      raf.current = 0
      const probe = window.scrollY + window.innerHeight * 0.35
      const tops = stations.map((s) => {
        const el = document.getElementById(s.key)
        return el ? el.getBoundingClientRect().top + window.scrollY : Infinity
      })
      let i = 0
      while (i < tops.length - 1 && probe >= tops[i + 1]) i++
      const a = stations[i]
      const b = stations[Math.min(i + 1, stations.length - 1)]
      const span = (tops[i + 1] ?? tops[i] + 1) - tops[i]
      const f = b === a || !Number.isFinite(span) ? 0 : Math.min(1, Math.max(0, (probe - tops[i]) / span))
      setReading({
        elev: a.elevationM + (b.elevationM - a.elevationM) * f,
        hours: a.hours + (b.hours - a.hours) * f,
      })
    }
    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const y = yOf(reading.elev)

  return (
    <nav
      aria-label="Sections, as stations down the river"
      className="pointer-events-none fixed inset-y-0 left-0 z-rail hidden w-rail lg:block"
    >
      <div className="relative h-full">
        {/* the staff: a light board so it reads on both grounds */}
        <div className="absolute bottom-staff-b left-4 top-staff-t w-3 bg-paper shadow-hair">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 12 100" aria-hidden="true">
            {profile.map((p, i) => (
              <line key={i} x1="0" x2={i % 3 === 0 ? 12 : 7} y1={yOf(p.elevationM)} y2={yOf(p.elevationM)} stroke="var(--ink)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
            ))}
            {/* water below the current stage */}
            <rect x="0" y={y} width="12" height={100 - y} fill="var(--w3)" opacity="0.55" />
          </svg>
        </div>

        {/* station marks: links down the profile */}
        {stations.map((s) => (
          <a
            key={s.key}
            href={`#${s.key}`}
            className="pointer-events-auto absolute left-8 flex -translate-y-1/2 items-center gap-1 rounded-sm px-1 text-micro text-fg-soft no-underline mix-blend-normal hover:text-fg"
            style={{ top: `${yOf(s.elevationM) * 0.92 + 3}%` }}
            aria-label={`${s.title}, station ${s.nodeLabel}, ${s.elevationM.toFixed(0)} metres`}
          >
            <span className="h-px w-2 bg-current" aria-hidden="true" />
            <span className="num">{s.nodeLabel}</span>
          </a>
        ))}

        {/* current stage readout */}
        <div
          className="absolute left-1 flex -translate-y-full flex-col items-start pb-1 transition-top duration-150"
          style={{ top: `${y * 0.92 + 3}%` }}
          aria-hidden="true"
        >
          <span className="flex items-center gap-1 rounded-sm bg-abyss px-1 text-micro text-foam">
            <WaterMark />
            <span className="num">{reading.elev.toFixed(0)} m</span>
          </span>
          <span className="num mt-0.5 rounded-sm bg-abyss px-1 text-micro text-foam-soft">t+{reading.hours.toFixed(0)} h</span>
        </div>
      </div>
    </nav>
  )
}
