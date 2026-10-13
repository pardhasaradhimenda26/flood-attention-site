import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  MathUtils,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { nodes } from '../data/network'
import { SceneCanvas } from './SceneCanvas'
import { getQuality, hasWebGL, type Quality } from './useAdaptiveQuality'
import { FlowTube } from './primitives/FlowTube'
import { widthToRadius } from '../lib/geometry'
import { createSharedWaveUniforms, createWaveMaterial, type SharedWaveUniforms } from './primitives/WavePulse'
import { GaugeNode, STAFF_H } from './primitives/GaugeNode'
import { reachCurve } from './curves'
import {
  edgeWaves,
  freezeTime,
  gaugeName,
  gauges,
  mainArrival,
  nodeById,
  pulsesAt,
  waveDuration,
} from '../lib/graph'
import { terrainBounds, terrainHeight } from '../lib/terrain'
import { readToken } from '../lib/tokens'
import { useSite } from '../state'
import { NetworkPlan } from '../components/NetworkPlan'
import { hero as heroCopy } from '../data/content'

/** Simulated hours per real second during the first pass (~10 s total). */
const SIM_RATE = waveDuration / 10.5

/* --------------------------------------------------------------- terrain */

function Terrain({ q }: { q: Quality }) {
  const { geometry, material } = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = terrainBounds
    const w = maxX - minX
    const d = maxZ - minZ
    const g = new PlaneGeometry(w, d, q.terrainRes, Math.round((q.terrainRes * d) / w))
    g.rotateX(-Math.PI / 2)
    g.translate(minX + w / 2, 0, minZ + d / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()

    const line = new Color(readToken('graticule'))
    if (!q.shadows) {
      // Without shadows the full PBR program buys nothing; this one compiles in
      // a fraction of the time on weak GPUs and draws the same chart.
      const lm = new ShaderMaterial({
        uniforms: {
          uBase: { value: new Color(readToken('abyss-raised')) },
          uSky: { value: new Color(readToken('foam-soft')) },
          uGround: { value: new Color(readToken('abyss')) },
          uLine: { value: line },
          uBounds: { value: [minX, maxX, minZ, maxZ] },
          uLightDir: { value: new Vector3(-8, 14, 9).normalize() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vP; varying float vDepth;
          void main() {
            vN = normal; vP = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uLine;
          uniform float uBounds[4]; uniform vec3 uLightDir;
          varying vec3 vN; varying vec3 vP; varying float vDepth;
          void main() {
            vec3 n = normalize(vN);
            float h = vP.y / 0.12;
            float fw = fwidth(h);
            float l = 1.0 - smoothstep(0.0, fw * 1.2, abs(fract(h - 0.5) - 0.5));
            float idx = 1.0 - smoothstep(0.0, fw * 1.6, abs(fract(h / 5.0 - 0.5) - 0.5) * 5.0);
            float crowd = 1.0 - smoothstep(0.25, 0.6, fw);
            vec3 albedo = mix(uBase, uLine, (l * 0.16 + idx * 0.18) * crowd);
            vec3 hemi = mix(uGround, uSky, 0.5 * n.y + 0.5) * 0.9;
            vec3 c = albedo / 3.14159 * (hemi + vec3(1.4) * max(dot(n, uLightDir), 0.0));
            c = mix(c, uGround, smoothstep(26.0, 60.0, vDepth));
            float ex = min(vP.x - uBounds[0], uBounds[1] - vP.x);
            float ez = min(vP.z - uBounds[2], uBounds[3] - vP.z);
            c = mix(uGround, c, smoothstep(0.0, 4.0, min(ex, ez)));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      })
      return { geometry: g, material: lm as ShaderMaterial | MeshStandardMaterial }
    }

    const m = new MeshStandardMaterial({
      color: new Color(readToken('abyss-raised')),
      roughness: 0.95,
      metalness: 0,
    })
    // Contour isolines every 0.12 world units of height, index line every 5th.
    // fog_fragment runs after the sRGB conversion, so compare in sRGB.
    const bg = new Color(readToken('abyss')).convertLinearToSRGB()
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uLine = { value: line }
      shader.uniforms.uBg = { value: bg }
      shader.uniforms.uBounds = { value: [minX, maxX, minZ, maxZ] }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying vec2 vXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;\nvXZ = position.xz;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uLine;\nuniform vec3 uBg;\nuniform float uBounds[4];\nvarying float vH;\nvarying vec2 vXZ;',
        )
        // Terrain dissolves into the abyss at its edges instead of ending in a cliff.
        .replace(
          '#include <fog_fragment>',
          `#include <fog_fragment>
          float ex = min(vXZ.x - uBounds[0], uBounds[1] - vXZ.x);
          float ez = min(vXZ.y - uBounds[2], uBounds[3] - vXZ.y);
          gl_FragColor.rgb = mix(uBg, gl_FragColor.rgb, smoothstep(0.0, 4.0, min(ex, ez)));`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float h = vH / 0.12;
          float fw = fwidth(h);
          float l = 1.0 - smoothstep(0.0, fw * 1.2, abs(fract(h - 0.5) - 0.5));
          float idx = 1.0 - smoothstep(0.0, fw * 1.6, abs(fract(h / 5.0 - 0.5) - 0.5) * 5.0);
          // Fade lines where they crowd below a pixel (steep faces) to avoid moiré.
          float crowd = 1.0 - smoothstep(0.25, 0.6, fw);
          diffuseColor.rgb = mix(diffuseColor.rgb, uLine, (l * 0.16 + idx * 0.18) * crowd);`,
        )
    }
    return { geometry: g, material: m as ShaderMaterial | MeshStandardMaterial }
  }, [q.terrainRes, q.shadows])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return <mesh geometry={geometry} material={material} receiveShadow={q.shadows} />
}

/* ----------------------------------------------------------------- tubes */

function WaveNetwork({ q, shared }: { q: Quality; shared: SharedWaveUniforms }) {
  const items = useMemo(() => {
    const deep = new Color(readToken('w4'))
    const shallow = new Color(readToken('w2'))
    const crest = '#f2fbfd'
    const areas = nodes.map((n) => n.drainageAreaKm2)
    const lo = Math.log(Math.min(...areas))
    const hi = Math.log(Math.max(...areas))
    return edgeWaves.map((w) => {
      const s = nodeById.get(w.edge.source)!
      const t = nodeById.get(w.edge.target)!
      const curve = reachCurve(s.id, t.id, 0.02)
      // Water ramp by drainage area: shallow headwaters → deep outlet.
      const f = (Math.log(t.drainageAreaKm2) - lo) / (hi - lo || 1)
      const base = '#' + shallow.clone().lerp(deep, f).getHexString()
      const len = s.pos && t.pos ? Math.hypot(t.pos[0] - s.pos[0], t.pos[2] - s.pos[2]) : 1
      return {
        key: w.edge.id,
        curve,
        r0: widthToRadius(s.channelWidthM),
        r1: widthToRadius(t.channelWidthM),
        tubular: Math.max(12, Math.round(len * q.tubularPerUnit * 2)),
        mat: createWaveMaterial(shared, w, base, crest),
        halo: q.halo ? createWaveMaterial(shared, w, base, readToken('w1'), true) : null,
      }
    })
  }, [q, shared])

  useEffect(
    () => () =>
      items.forEach((i) => {
        i.mat.dispose()
        i.halo?.dispose()
      }),
    [items],
  )

  return (
    <group>
      {items.map((i) => (
        <group key={i.key}>
          <FlowTube
            curve={i.curve}
            r0={i.r0}
            r1={i.r1}
            tubular={i.tubular}
            radial={q.radialSegments}
            material={i.mat}
            castShadow={q.shadows}
          />
          {i.halo && (
            <FlowTube
              curve={i.curve}
              r0={i.r0 * 2.6}
              r1={i.r1 * 2.6}
              tubular={i.tubular}
              radial={q.radialSegments}
              material={i.halo}
              renderOrder={2}
            />
          )}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------ gauge tags */

/*
  Gauge tags are plain DOM, one layer for all four, positioned by projecting
  each staff top through the camera on every rendered frame. Cheaper than a
  React root per label, and it never renders when the canvas is paused.
*/
const tagEls: (HTMLDivElement | null)[] = []
const tagAnchor = gauges.map((g) => new Vector3(g.pos[0], g.pos[1] + STAFF_H + 0.62, g.pos[2]))

function TagProjector() {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    tagAnchor.forEach((a, i) => {
      const el = tagEls[i]
      if (!el) return
      v.copy(a).project(camera)
      const inside = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.visibility = inside ? 'visible' : 'hidden'
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`
    })
  })
  return null
}

function GaugeTagLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ contain: 'strict' }} aria-hidden="true">
      {gauges.map((g, i) => {
        const arr = mainArrival(g.id)
        const first = Math.min(...pulsesAt.get(g.id)!.map((p) => p.arrival))
        const t = Number.isFinite(arr) ? arr : first
        return (
          <div
            key={g.id}
            ref={(el) => {
              tagEls[i] = el
            }}
            className="absolute left-0 top-0 whitespace-nowrap text-center text-micro text-foam"
            style={{ visibility: 'hidden', willChange: 'transform' }}
          >
            <span className="num">{gaugeName.get(g.id)}</span>{' '}
            <span className="text-foam-soft">{g.gaugeRole?.replace('_', '-')}</span>
            <br />
            <span className="num text-foam-soft">peak t+{t.toFixed(1)} h</span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- camera */

// Camera stands downstream and looks up the valley; the dolly follows the flow.
const scrollState = { p: 0 }
const T0 = new Vector3(-1.0, 1.0, 0.6)
const T1 = new Vector3(5.0, 0.4, 0.4)

function CameraRig({ q, playing }: { q: Quality; playing: React.MutableRefObject<number> }) {
  const { camera, gl, size, invalidate } = useThree()
  const drag = useRef({ az: 0, pol: 0, active: false, x: 0, y: 0, mouse: false })
  const cur = useRef({ target: T0.clone(), init: false })
  const reduced = useSite((s) => s.reducedMotion)

  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      drag.current.active = true
      drag.current.x = e.clientX
      drag.current.y = e.clientY
      drag.current.mouse = e.pointerType === 'mouse'
    }
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      d.az = MathUtils.clamp(d.az - (e.clientX - d.x) * 0.005, -0.7, 0.7)
      if (d.mouse) d.pol = MathUtils.clamp(d.pol + (e.clientY - d.y) * 0.004, -0.25, 0.32)
      d.x = e.clientX
      d.y = e.clientY
      invalidate()
    }
    const up = () => (drag.current.active = false)
    // Scroll is read here, never inside the frame loop: a read there after the
    // tag layer's style writes would force a layout of the whole page per frame.
    const scroll = () => {
      scrollState.p = window.scrollY / Math.max(1, window.innerHeight)
      invalidate()
    }
    scroll()
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('scroll', scroll)
    }
  }, [gl, invalidate])

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const portrait = aspect < 1
    const coupled = q.scrollCamera && !reduced
    const scrollP = coupled ? MathUtils.clamp(scrollState.p, 0, 1) : 0
    const dolly = coupled ? playing.current * 0.35 : 0
    const p = MathUtils.clamp(dolly + scrollP * 0.8, 0, 1)
    const target = T0.clone().lerp(T1, p)
    // Portrait: centre on the whole basin; the river runs up the screen.
    if (portrait) target.set(1.2 + p * 3, 0.9, 0.3)

    const radius = portrait ? Math.min(66, 35 / Math.max(0.45, aspect)) : 40 - Math.min(aspect, 2.2) * 2
    const az = (portrait ? 1.42 : 1.02) + drag.current.az - p * 0.25
    const pol = (portrait ? 0.62 : 0.9) + drag.current.pol - p * 0.08
    const desired = new Vector3(
      target.x + radius * Math.sin(pol) * Math.sin(az),
      target.y + radius * Math.cos(pol),
      target.z + radius * Math.sin(pol) * Math.cos(az),
    )
    const k = reduced || !cur.current.init ? 1 : 1 - Math.exp(-Math.min(dt, 1 / 30) * 3.5)
    cur.current.init = true
    cam.position.lerp(desired, k)
    cur.current.target.lerp(target, k)
    cam.lookAt(cur.current.target)
    // On wide screens shift the projection so the network sits right of the
    // headline column instead of under it.
    const shift = aspect > 1.25 ? Math.round(size.width * Math.min(0.24, (aspect - 1.05) * 0.32)) : 0
    const lift = aspect > 1.25 ? Math.round(size.height * 0.06) : 0
    const view = cam.view
    if (shift && (!view || view.offsetX !== -shift || view.fullWidth !== size.width || view.fullHeight !== size.height)) {
      cam.setViewOffset(size.width, size.height, -shift, lift, size.width, size.height)
    } else if (!shift && view?.enabled) {
      cam.clearViewOffset()
    }
    if (k < 1 && cam.position.distanceToSquared(desired) > 1e-5) invalidate()
  })
  return null
}

/* ----------------------------------------------------------------- clock */

function WaveClock({ shared, progress }: { shared: SharedWaveUniforms; progress: React.MutableRefObject<number> }) {
  const invalidate = useThree((s) => s.invalidate)
  const lastPush = useRef(0)
  const playing = useSite((s) => s.heroPlaying)
  const reduced = useSite((s) => s.reducedMotion)

  useEffect(() => {
    if (reduced) {
      shared.uTime.value = freezeTime
      shared.uEnvelope.value = 1
      useSite.getState().setHeroTime(freezeTime)
      useSite.getState().setHeroSettled(true)
      invalidate()
    }
  }, [reduced, shared, invalidate])

  useEffect(
    () =>
      useSite.subscribe((s, prev) => {
        if (s.heroSeekTo !== null && s.heroSeekTo !== prev.heroSeekTo) invalidate()
      }),
    [invalidate],
  )

  useFrame((state, dt) => {
    const st = useSite.getState()
    const seek = st.consumeSeek()
    if (seek !== null) {
      shared.uTime.value = seek
      if (seek === 0) shared.uEnvelope.value = 0
    }
    if (playing && !reduced) {
      shared.uTime.value += Math.min(dt, 0.12) * SIM_RATE
      progress.current = Math.min(1, shared.uTime.value / waveDuration)
      if (shared.uTime.value >= waveDuration) {
        shared.uTime.value = waveDuration
        st.setHeroSettled(true)
      }
    }
    // After the first pass the peak envelope fades in: the attenuation map.
    const settled = useSite.getState().heroSettled
    const target = settled ? 1 : 0
    if (Math.abs(shared.uEnvelope.value - target) > 0.002) {
      shared.uEnvelope.value += (target - shared.uEnvelope.value) * Math.min(1, Math.min(dt, 1 / 30) * 2.2)
      invalidate()
    }
    if (state.clock.elapsedTime - lastPush.current > 0.12 || seek !== null) {
      lastPush.current = state.clock.elapsedTime
      if (Math.abs(st.heroTime - shared.uTime.value) > 0.05) st.setHeroTime(shared.uTime.value)
    }
  })
  return null
}

/* ----------------------------------------------------------------- scene */

function Scene() {
  const q = getQuality()
  const reduced = useSite((s) => s.reducedMotion)
  const shared = useMemo(() => createSharedWaveUniforms(reduced ? freezeTime : 0), [reduced])
  const progress = useRef(0)
  const abyss = readToken('abyss')
  return (
    <>
      <color attach="background" args={[abyss]} />
      <fog attach="fog" args={[abyss, 26, 60]} />
      <hemisphereLight args={[readToken('foam-soft'), abyss, 0.9]} />
      <directionalLight
        position={[-8, 14, 9]}
        intensity={1.4}
        castShadow={q.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-radius={6}
        shadow-bias={-0.0004}
      />
      <Terrain q={q} />
      <WaveNetwork q={q} shared={shared} />
      <GaugeNode nodes={nodes} segments={q.radialSegments} radius={0.085} />
      <TagProjector />
      <WaveClock shared={shared} progress={progress} />
      <CameraRig q={q} playing={progress} />
    </>
  )
}

export default function RiverScene() {
  const settled = useSite((s) => s.heroSettled)
  const reduced = useSite((s) => s.reducedMotion)
  return (
    <div className="absolute inset-0">
    <SceneCanvas
      name="hero"
      className="absolute inset-0"
      frameloop={settled || reduced ? 'demand' : 'always'}
      camera={{ fov: 30, near: 0.5, far: 120, position: [-16, 10, 14] }}
      shadows
      touchAction="pan-y"
      wrapperProps={{ role: 'img', 'aria-label': heroCopy.sceneLabel }}
      fallback={<NetworkPlan mode="wave" className="h-full w-full lg:ml-auto lg:w-3/5 lg:py-16" />}
    >
      <Scene />
    </SceneCanvas>
    {hasWebGL() && <GaugeTagLayer />}
    </div>
  )
}
