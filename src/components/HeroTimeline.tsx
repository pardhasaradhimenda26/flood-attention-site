import { StormTimeline } from './StormTimeline'
import { HeroGaugeTable } from './HeroGaugeTable'
import { Locator } from './Locator'

/**
 * The hero's storm timeline and its table: one lazy chunk with the storm data.
 * On wide screens, with the 3D scene, the locator map sits just above it.
 */
export default function HeroTimeline({ drive, locator }: { drive: boolean; locator: boolean }) {
  return (
    <>
      {locator && <Locator className="absolute bottom-full right-8 mb-4 hidden w-56 lg:block" />}
      <StormTimeline drive={drive} />
      <HeroGaugeTable />
    </>
  )
}
