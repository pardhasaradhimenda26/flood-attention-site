import { useEffect, useMemo, type ReactNode } from 'react'
import { type Curve, type Material, type Vector3 } from 'three'
import { buildTube } from './tube'

type Props = {
  curve: Curve<Vector3>
  r0: number
  r1: number
  tubular: number
  radial: number
  material: Material
  castShadow?: boolean
  renderOrder?: number
  children?: ReactNode
}

export function FlowTube({ curve, r0, r1, tubular, radial, material, castShadow, renderOrder }: Props) {
  const geometry = useMemo(() => buildTube(curve, r0, r1, tubular, radial), [curve, r0, r1, tubular, radial])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} material={material} castShadow={castShadow} renderOrder={renderOrder} />
  )
}
