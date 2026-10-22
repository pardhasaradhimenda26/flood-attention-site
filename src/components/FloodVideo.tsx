import { hero } from '../data/content'

/*
  The hero without WebGL: the modelled inundation for the whole of August 2018,
  rendered from the HEC-RAS output on the 25 m grid (export_wayanad_site.py
  --video). The plan-view map is the poster, so something real shows before
  the video loads, and nothing loads at all unless this is the view in use.
*/
export function FloodVideo({ className = '', still = false }: { className?: string; still?: boolean }) {
  const base = `${import.meta.env.BASE_URL}wayanad/`
  if (still) {
    return <img src={`${base}plan.png`} alt="" aria-hidden="true" className={`object-contain ${className}`} />
  }
  return (
    <video
      className={`object-contain ${className}`}
      src={`${base}inundation_T1.mp4`}
      poster={`${base}plan.png`}
      preload="none"
      muted
      loop
      playsInline
      controls
      aria-label={hero.fallbackLabel}
    />
  )
}
