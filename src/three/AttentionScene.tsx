import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, MathUtils, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three'
import { edges, nodes, type NetEdge, type NetNode } from '../data/network'
import { SceneCanvas } from './SceneCanvas'
import { getQuality } from './useAdaptiveQuality'
import { buildTube } from './primitives/tube'
import { GaugeNode } from './primitives/GaugeNode'
import { messageArc, reachCurve } from './curves'
import { incomingAll, nodeById, weightOf } from '../lib/graph'
import { readToken } from '../lib/tokens'
import { useSite } from '../state'
import { NetworkPlan } from '../components/NetworkPlan'

/*
  Same network, now showing aggregation. Every message edge is a tube whose
  radius is set in the vertex shader (centreline + normal × radius), so
  weights can change every frame without rebuilding geometry. Magenta is the
  attention signal and appears only in learned mode, only on edges.
*/

const vert = /* glsl */ `
  uniform float uRadius;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 p = position + normal * uRadius;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = abs(dot(normalize(vN), normalize(vV)));
    vec3 c = uColor * (0.55 + 0.45 * f);
    gl_FragColor = vec4(c, uOpacity);
    #include <colorspace_fragment>
  }
`

type EdgeVis = {
  edge: NetEdge
  mat: ShaderMaterial
  r: number
  o: number
  c: Color
}

function radiusFor(w: number) {
  return 0.018 + 0.26 * w
}

function Edges({ focus }: { focus: string | null }) {
  const q = getQuality()
  const mode = useSite((s) => s.aggMode)
  const step = useSite((s) => s.step)
  const reduced = useSite((s) => s.reducedMotion)
  const invalidate = useThree((s) => s.invalidate)

  const signal = useMemo(() => new Color(readToken('signal-lift')), [])
  const neutral = useMemo(() => new Color(readToken('foam-soft')), [])
  const dim = useMemo(() => new Color(readToken('foam-soft')).multiplyScalar(0.55), [])

  const items = useMemo(() => {
    return edges.map((e) => {
      const curve = e.routing ? reachCurve(e.source, e.target, 0.05) : messageArc(e.source, e.target, e.hops, 0.05)
      const geo = buildTube(curve, 0, 0, e.routing ? 24 : 40, q.radialSegments)
      const mat = new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: true,
        uniforms: {
          uRadius: { value: 0.03 },
          uColor: { value: neutral.clone() },
          uOpacity: { value: e.routing ? 0.8 : 0 },
        },
      })
      return { edge: e, geo, vis: { edge: e, mat, r: 0.03, o: e.routing ? 0.8 : 0, c: neutral.clone() } as EdgeVis }
    })
  }, [q.radialSegments, neutral])

  useEffect(
    () => () =>
      items.forEach((i) => {
        i.geo.dispose()
        i.vis.mat.dispose()
      }),
    [items],
  )

  // Targets for the current state.
  const targets = useMemo(() => {
    const inc = new Set((focus ? incomingAll.get(focus) : [])?.map((e) => e.id))
    return items.map(({ edge }) => {
      const w = weightOf(edge, mode, step)
      const isIn = inc.has(edge.id)
      let r = radiusFor(w)
      let o = 0
      let c = mode === 'learned' ? signal : neutral
      if (!focus) {
        o = edge.routing ? 0.95 : 0
      } else if (isIn) {
        o = 1
      } else if (edge.routing) {
        o = 0.55
        r = 0.026
        c = dim
      }
      return { r, o, c }
    })
  }, [items, focus, mode, step, signal, neutral, dim])

  useEffect(() => invalidate(), [targets, invalidate])

  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 1 / 30) * 9)
    let moving = false
    items.forEach(({ vis }, i) => {
      const t = targets[i]
      vis.r += (t.r - vis.r) * k
      vis.o += (t.o - vis.o) * (reduced ? 1 : k)
      vis.c.lerp(t.c, k)
      if (Math.abs(t.r - vis.r) > 1e-4 || Math.abs(t.o - vis.o) > 1e-3) moving = true
      const u = vis.mat.uniforms
      u.uRadius.value = vis.r
      u.uOpacity.value = vis.o
      ;(u.uColor.value as Color).copy(vis.c)
    })
    if (moving) invalidate()
  })

  return (
    <group>
      {items.map(({ edge, geo, vis }) => (
        <mesh
          key={edge.id}
          geometry={geo}
          material={vis.mat}
          renderOrder={edge.routing ? 1 : 2}
          visible={true}
        />
      ))}
    </group>
  )
}

function Labels({ focus }: { focus: string | null }) {
  const mode = useSite((s) => s.aggMode)
  const step = useSite((s) => s.step)
  if (!focus) return null
  const n = nodeById.get(focus)!
  const inc = incomingAll.get(focus) ?? []
  return (
    <group>
      <Html position={[n.pos[0], n.pos[1] + 0.55, n.pos[2]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="num whitespace-nowrap rounded-sm bg-abyss px-1 text-micro text-foam" aria-hidden="true">
          {n.label}
        </div>
      </Html>
      {inc.map((e) => {
        const s = nodeById.get(e.source)!
        const w = weightOf(e, mode, step)
        // Weight sits at the apex of its own edge; arcs for 2 and 3 hops peak
        // at different heights, so labels for one branch do not collide.
        const curve = e.routing ? reachCurve(e.source, e.target, 0.05) : messageArc(e.source, e.target, e.hops, 0.05)
        const apex = curve.getPoint(0.5)
        return (
          <group key={e.id}>
            <Html position={[apex.x, apex.y + (e.routing ? 0.3 : 0.18), apex.z]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`num whitespace-nowrap text-micro ${mode === 'learned' ? 'text-signal-lift' : 'text-foam'}`} aria-hidden="true">
                {w.toFixed(2)}
              </div>
            </Html>
            <Html position={[s.pos[0], s.pos[1] - 0.38, s.pos[2]]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
              <div className="num whitespace-nowrap text-micro text-foam-soft" aria-hidden="true">
                {s.label}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function Rig() {
  const { camera, gl, size, invalidate } = useThree()
  const drag = useRef({ az: 0, pol: 0, on: false, x: 0, y: 0, mouse: false })
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => Object.assign(drag.current, { on: true, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' })
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.on) return
      d.az = MathUtils.clamp(d.az - (e.clientX - d.x) * 0.004, -0.55, 0.55)
      if (d.mouse) d.pol = MathUtils.clamp(d.pol + (e.clientY - d.y) * 0.003, -0.2, 0.25)
      d.x = e.clientX
      d.y = e.clientY
      invalidate()
    }
    const up = () => (drag.current.on = false)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl, invalidate])
  const selected = useSite((s) => s.selected)
  const reduced = useSite((s) => s.reducedMotion)
  const cur = useRef<{ pos: Vector3; target: Vector3 } | null>(null)
  useEffect(() => invalidate(), [selected, invalidate])

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const t = Math.tan(MathUtils.degToRad(cam.fov / 2))
    // Selecting a node moves the view toward it; Escape returns to the basin.
    const f = nodeById.get(selected)
    const zoom = f ? 0.58 : 1
    const center = new Vector3(0.3, 0.9, 0.3)
    const target = f ? center.clone().lerp(new Vector3(f.pos[0], f.pos[1], f.pos[2]), 0.72) : center
    const pos = new Vector3()
    if (aspect < 0.95) {
      // Portrait: plan view with the river running top to bottom.
      const r = Math.max(13.5 / t, 6 / (t * aspect)) * zoom
      const az = drag.current.az * 0.6
      cam.up.set(-Math.cos(az), 0, Math.sin(az))
      pos.set(target.x, target.y + r, target.z + r * 0.18)
    } else {
      // Landscape: fit the network's 24-unit length across the frame.
      const r = Math.max(15, 12.8 / (t * aspect)) * 1.04 * zoom
      const az = drag.current.az
      const pol = 0.55 + drag.current.pol
      cam.up.set(0, 1, 0)
      pos.set(target.x + r * Math.sin(pol) * Math.sin(az), target.y + r * Math.cos(pol), target.z + r * Math.sin(pol) * Math.cos(az))
    }
    if (!cur.current) cur.current = { pos: pos.clone(), target: target.clone() }
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 1 / 30) * 5)
    cur.current.pos.lerp(pos, k)
    cur.current.target.lerp(target, k)
    cam.position.copy(cur.current.pos)
    cam.lookAt(cur.current.target)
    if (cur.current.pos.distanceToSquared(pos) > 1e-4) invalidate()
  })
  return null
}

function Scene() {
  const q = getQuality()
  const selected = useSite((s) => s.selected)
  const hovered = useSite((s) => s.hovered)
  const setSelected = useSite((s) => s.setSelected)
  const setHovered = useSite((s) => s.setHovered)
  const focus = hovered ?? (selected || null)
  const abyss = readToken('abyss')

  const colorOf = useMemo(() => {
    const inc = new Set((focus ? incomingAll.get(focus) : [])?.map((e) => e.source))
    const foam = readToken('foam')
    const soft = readToken('foam-soft')
    const dimc = '#' + new Color(soft).lerp(new Color(readToken('abyss')), 0.45).getHexString()
    return (n: NetNode) => (!focus ? soft : n.id === focus ? foam : inc.has(n.id) ? foam : dimc)
  }, [focus])
  const scaleOf = useMemo(() => (n: NetNode) => (n.id === focus ? 1.7 : 1), [focus])

  return (
    <>
      <color attach="background" args={[abyss]} />
      <hemisphereLight args={[readToken('foam'), abyss, 1.2]} />
      <directionalLight position={[4, 12, 6]} intensity={0.9} />
      <Edges focus={focus} />
      <GaugeNode
        nodes={nodes}
        segments={q.radialSegments}
        radius={0.13}
        colorOf={colorOf}
        scaleOf={scaleOf}
        showStaffs={false}
        onPick={(n) => setSelected(n.id)}
        onHover={(n) => {
          setHovered(n ? n.id : null)
          document.body.style.cursor = n ? 'pointer' : ''
        }}
      />
      <Labels focus={focus} />
      <Rig />
    </>
  )
}

export default function AttentionScene({ label, className }: { label: string; className?: string }) {
  const setSelected = useSite((s) => s.setSelected)
  return (
    <SceneCanvas
      name="attention"
      className={className}
      frameloop="demand"
      camera={{ fov: 30, near: 0.5, far: 120, position: [0, 20, 20] }}
      touchAction="pan-y"
      wrapperProps={{ 'aria-label': label, role: 'img' }}
      fallback={<NetworkPlan mode="attention" className="h-full w-full" onSelect={setSelected} />}
    >
      <Scene />
    </SceneCanvas>
  )
}
