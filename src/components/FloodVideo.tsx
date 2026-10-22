import { hero } from '../data/content'

/*
  The hero without WebGL (or on a software renderer): the modelled inundation
  for the whole of August 2018, from the HEC-RAS output on the 25 m grid, over
  the same satellite imagery as the 3D hero (export_wayanad_site.py --video).
  Its frame at the inflow peak is the poster, so something real shows before
  the video loads, and nothing loads at all unless this is the view in use.
*/
export function FloodVideo({ className = '' }: { className?: string }) {
  const base = `${import.meta.env.BASE_URL}wayanad/`
  return (
    <video
      className={`object-contain ${className}`}
      src={`${base}inundation_T1.mp4`}
      poster={`${base}poster.jpg`}
      preload="none"
      muted
      loop
      playsInline
      controls
      aria-label={hero.fallbackLabel}
    />
  )
}
