import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  MathUtils,
  MeshStandardMaterial,
  Shape,
  ShaderMaterial,
  type Mesh,
  type PerspectiveCamera,
} from 'three'
import { SceneCanvas } from './SceneCanvas'
import { bankfull, hydraulics, profile, stageMax } from '../lib/section'
import { readToken } from '../lib/tokens'
import { useSite } from '../state'

/*
  The section extruded along the channel into a short reach of river, with a
  water body whose surface follows the stage slider and a staff gauge on the
  bank — this is a gauged section. Horizontal 1 unit = 4 m, vertical ×4.
*/

const H = 0.25 // horizontal metres → units
const V = 1.0 // vertical metres → units (×4 exaggeration relative to H)
const LEN = 9
const DATUM = -0.6

function shapeOf(points: [number, number][], closeTo: number | null) {
  const sh = new Shape()
  points.forEach(([x, z], i) => (i ? sh.lineTo(x * H, z * V) : sh.moveTo(x * H, z * V)))
  if (closeTo !== null) {
    const last = points[points.length - 1]
    const first = points[0]
    sh.lineTo(last[0] * H, closeTo)
    sh.lineTo(first[0] * H, closeTo)
  }
  sh.closePath()
  return sh
}

function Channel() {
  const stage = useSite((s) => s.stageM)
  const reduced = useSite((s) => s.reducedMotion)
  const invalidate = useThree((s) => s.invalidate)
  const shown = useRef(stage)

  const ground = useMemo(() => {
    const g = new ExtrudeGeometry(shapeOf(profile, DATUM), { depth: LEN, bevelEnabled: false, steps: 1 })
    g.translate(0, 0, -LEN / 2)
    const line = new Color(readToken('graticule'))
    const m = new MeshStandardMaterial({ color: new Color(readToken('abyss-raised')), roughness: 0.9 })
    // survey hatching on the cut face: horizontal lines every 0.25 m
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLine = { value: line }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uLine;\nvarying vec3 vP;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float g = abs(fract(vP.y * 4.0 + 0.5) - 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, uLine, (1.0 - smoothstep(0.0, fwidth(vP.y * 4.0) * 1.5, g)) * 0.35);`,
        )
    }
    return { g, m }
  }, [])

  const water = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: new Color(readToken('w3')),
      transparent: true,
      opacity: 0.78,
      roughness: 0.25,
      side: DoubleSide,
    })
    return { m, g: null as ExtrudeGeometry | null }
  }, [])

  const staff = useMemo(() => {
    const g = new BoxGeometry(0.09, stageMax * V + 0.4, 0.09)
    const m = new ShaderMaterial({
      uniforms: { uL: { value: new Color(readToken('foam')) }, uD: { value: new Color(readToken('abyss')) } },
      vertexShader: 'varying float vY; void main(){ vY = position.y + 1.4; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 uL; uniform vec3 uD; varying float vY; void main(){ float b = step(0.5, fract(vY * 10.0)); float M = step(0.85, fract(vY * 2.0)); gl_FragColor = vec4(mix(uD, uL, max(b, M)), 1.0);\n#include <colorspace_fragment>\n}',
    })
    return { g, m }
  }, [])

  const mesh = useRef<Mesh>(null)

  const rebuild = (h: number) => {
    const hy = hydraulics(h)
    if (hy.poly.length < 2 || !mesh.current) return
    const pts: [number, number][] = [...hy.poly]
    const g = new ExtrudeGeometry(shapeOf(pts, null), { depth: LEN - 0.02, bevelEnabled: false, steps: 1 })
    g.translate(0, 0.004, -(LEN - 0.02) / 2)
    water.g?.dispose()
    water.g = g
    mesh.current.geometry = g
  }

  useEffect(() => {
    rebuild(shown.current)
    invalidate()
    return () => {
      ground.g.dispose()
      ground.m.dispose()
      water.m.dispose()
      water.g?.dispose()
      staff.g.dispose()
      staff.m.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => invalidate(), [stage, invalidate])

  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 1 / 30) * 10)
    const next = shown.current + (stage - shown.current) * k
    if (Math.abs(next - shown.current) > 1e-4 || Math.abs(stage - shown.current) > 1e-4) {
      shown.current = Math.abs(stage - next) < 1e-3 ? stage : next
      rebuild(shown.current)
      if (shown.current !== stage) invalidate()
    }
  })

  const bankX = profile.find(([, z], i) => i > 8 && z >= bankfull)?.[0] ?? 14
  return (
    <group>
      <mesh geometry={ground.g} material={ground.m} />
      <mesh ref={mesh} material={water.m} />
      <mesh geometry={staff.g} material={staff.m} position={[bankX * H + 0.25, (stageMax * V + 0.4) / 2 - 0.05, LEN / 2 - 0.6]} />
    </group>
  )
}

function Rig() {
  const { camera, gl, size, invalidate } = useThree()
  const d = useRef({ az: 0, on: false, x: 0 })
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => Object.assign(d.current, { on: true, x: e.clientX })
    const move = (e: PointerEvent) => {
      if (!d.current.on) return
      d.current.az = MathUtils.clamp(d.current.az - (e.clientX - d.current.x) * 0.005, -0.6, 0.6)
      d.current.x = e.clientX
      invalidate()
    }
    const up = () => (d.current.on = false)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl, invalidate])
  useFrame(() => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const r = aspect < 1 ? 30 : 22
    const az = 0.5 + d.current.az
    cam.position.set(Math.sin(az) * r, 7.5, Math.cos(az) * r)
    cam.lookAt(0, 0.7, 0)
  })
  return null
}

export default function CrossSection({ label, fallback, className }: { label: string; fallback: ReactNode; className?: string }) {
  const abyss = readToken('abyss')
  return (
    <SceneCanvas
      name="section"
      className={className}
      frameloop="demand"
      camera={{ fov: 32, near: 0.5, far: 100, position: [10, 7, 18] }}
      touchAction="pan-y"
      wrapperProps={{ role: 'img', 'aria-label': label }}
      fallback={fallback}
    >
      <color attach="background" args={[abyss]} />
      <hemisphereLight args={[readToken('foam'), abyss, 1.1]} />
      <directionalLight position={[6, 10, 8]} intensity={1.2} />
      <Channel />
      <Rig />
    </SceneCanvas>
  )
}
