import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import type { NetNode } from '../../data/network'
import { readToken } from '../../lib/tokens'

/*
  Node markers, instanced: one draw call for every cross-section and one for
  the gauge staffs. Gauged nodes carry a staff gauge — banded like the real
  thing — because they are the only places a measurement exists.
*/

const STAFF_H = 1.05

const staffVertex = /* glsl */ `
  varying float vY;
  void main() {
    vY = position.y + ${(STAFF_H / 2).toFixed(3)};
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const staffFragment = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uDark;
  varying float vY;
  void main() {
    float band = step(0.5, fract(vY * 10.0));
    float major = step(0.8, fract(vY * 2.0));
    vec3 c = mix(uDark, uLight, max(band, major));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`

type Props = {
  nodes: NetNode[]
  segments: number
  /** marker radius in world units */
  radius?: number
  /** per-node colour override (hex); default foam-soft */
  colorOf?: (n: NetNode) => string
  /** per-node scale override */
  scaleOf?: (n: NetNode) => number
  showStaffs?: boolean
  onPick?: (n: NetNode) => void
  onHover?: (n: NetNode | null) => void
}

export function GaugeNode({
  nodes,
  segments,
  radius = 0.11,
  colorOf,
  scaleOf,
  showStaffs = true,
  onPick,
  onHover,
}: Props) {
  const discs = useRef<InstancedMesh>(null)
  const hits = useRef<InstancedMesh>(null)
  const staffs = useRef<InstancedMesh>(null)
  const gauged = useMemo(() => nodes.filter((n) => n.gauged), [nodes])

  const res = useMemo(() => {
    const sphere = new SphereGeometry(1, segments + 4, Math.max(6, segments))
    const hit = new SphereGeometry(1, 8, 6)
    const box = new BoxGeometry(0.06, STAFF_H, 0.06)
    const discMat = new MeshLambertMaterial()
    const hitMat = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    const staffMat = new ShaderMaterial({
      vertexShader: staffVertex,
      fragmentShader: staffFragment,
      uniforms: {
        uLight: { value: new Color(readToken('foam')) },
        uDark: { value: new Color(readToken('abyss')) },
      },
    })
    return { sphere, hit, box, discMat, hitMat, staffMat }
  }, [segments])

  useEffect(
    () => () => {
      Object.values(res).forEach((r) => r.dispose())
    },
    [res],
  )

  useLayoutEffect(() => {
    const o = new Object3D()
    const c = new Color()
    const fallback = readToken('foam-soft')
    nodes.forEach((n, i) => {
      const s = (scaleOf?.(n) ?? 1) * radius * (n.gauged ? 1.25 : 1)
      o.position.set(n.pos[0], n.pos[1] + 0.06, n.pos[2])
      o.scale.setScalar(s)
      o.updateMatrix()
      discs.current?.setMatrixAt(i, o.matrix)
      discs.current?.setColorAt(i, c.set(colorOf?.(n) ?? fallback))
      o.scale.setScalar(Math.max(radius * 2.6, s * 1.6))
      o.updateMatrix()
      hits.current?.setMatrixAt(i, o.matrix)
    })
    if (discs.current) {
      discs.current.instanceMatrix.needsUpdate = true
      if (discs.current.instanceColor) discs.current.instanceColor.needsUpdate = true
    }
    if (hits.current) hits.current.instanceMatrix.needsUpdate = true
    gauged.forEach((n, i) => {
      o.position.set(n.pos[0], n.pos[1] + STAFF_H / 2 + 0.05, n.pos[2])
      o.scale.setScalar(1)
      o.updateMatrix()
      staffs.current?.setMatrixAt(i, o.matrix)
    })
    if (staffs.current) staffs.current.instanceMatrix.needsUpdate = true
  }, [nodes, gauged, colorOf, scaleOf, radius])

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const id = e.instanceId
    return id == null ? null : nodes[id]
  }

  return (
    <group>
      <instancedMesh ref={discs} args={[res.sphere, res.discMat, nodes.length]} />
      {showStaffs && gauged.length > 0 && (
        <instancedMesh ref={staffs} args={[res.box, res.staffMat, gauged.length]} />
      )}
      {(onPick || onHover) && (
        <instancedMesh
          ref={hits}
          args={[res.hit, res.hitMat, nodes.length]}
          onPointerMove={(e) => {
            e.stopPropagation()
            onHover?.(pick(e))
          }}
          onPointerOut={() => onHover?.(null)}
          onClick={(e) => {
            e.stopPropagation()
            const n = pick(e)
            if (n) onPick?.(n)
          }}
        />
      )}
    </group>
  )
}

export { STAFF_H }
