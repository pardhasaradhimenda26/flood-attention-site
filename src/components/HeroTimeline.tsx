import { StormTimeline } from './StormTimeline'
import { HeroGaugeTable } from './HeroGaugeTable'

/** The hero's storm timeline and its table: one lazy chunk with the storm data. */
export default function HeroTimeline({ drive }: { drive: boolean }) {
  return (
    <>
      <StormTimeline drive={drive} />
      <HeroGaugeTable />
    </>
  )
}
