import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  MathUtils,
  MeshLambertMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { SceneCanvas } from './SceneCanvas'
import { getQuality, hasWebGL, type Quality } from './useAdaptiveQuality'
import { W, depthAt, dischargeAt, holdHour, lastHour, sceneLabel, sections, stormGauges, type Section } from '../lib/storm'
import { readToken } from '../lib/tokens'
import { buildValleyArrays, type ValleyArrays, type ValleyParams } from './valleyBuild'
import { useSite } from '../state'
import { FloodVideo } from '../components/FloodVideo'
import { fmt } from '../lib/format'

/*
  The hero: the Wayanad valley flooding in event T1 of the HEC-RAS 2D model.

  Terrain is the bed elevation of the model's own cells on a 50 m grid
  (public/wayanad/terrain.bin); the water is the model's depth in every cell,
  every two hours, interpolated between frames (flood.bin). Nothing here is a
  shader approximation of flooding: where the water is, the model put it.

  Vertical scale is exaggerated (VEX) for ground and water alike, so depth and
  relief stay in proportion to each other; the label says so. The ground
  outside the modelled area is a neutral fill, drawn darker and without
  contours, because no elevation data was supplied there.
*/

/** Vertical exaggeration: the reach drops 47 m over 30 km. */
const VEX = 30
/** World units per kilometre. */
const KM = 1
const HOURS_PER_SEC = 12

type Data = { flood: Uint8Array; a: ValleyArrays }

/**
 * Fetch the model output and build the valley in a worker; the main thread
 * only wraps the finished buffers. Without workers, the same code runs here.
 */
function useValley(stride: number): Data | null {
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => {
    let alive = true
    const base = new URL(`${import.meta.env.BASE_URL}wayanad/`, window.location.href).href
    const p: ValleyParams = { nx: W.nx, ny: W.ny, cellM: W.cellM, bedLo, vex: VEX, km: KM, stride }
    const local = () => {
      const get = (f: string) =>
        fetch(base + f).then((r) => {
          if (!r.ok) throw new Error(f + ' ' + r.status)
          return r.arrayBuffer()
        })
      Promise.all([get('terrain.bin'), get('wet.bin'), get('flood.bin')])
        .then(([t, w, f]) => {
          if (alive) setD({ flood: new Uint8Array(f), a: buildValleyArrays(new Float32Array(t), new Uint32Array(w), p) })
        })
        .catch(() => alive && setD(null))
    }
    if (typeof Worker === 'undefined') {
      local()
      return () => {
        alive = false
      }
    }
    const worker = new Worker(new URL('./valley.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ ok: true; flood: Uint8Array; a: ValleyArrays } | { ok: false }>) => {
      worker.terminate()
      if (!alive) return
      if (e.data.ok) setD({ flood: e.data.flood, a: e.data.a })
      else setD(null)
    }
    worker.onerror = () => {
      worker.terminate()
      if (alive) local()
    }
    worker.postMessage({ base, p })
    return () => {
      alive = false
      worker.terminate()
    }
  }, [stride])
  return d
}

/* ------------------------------------------------------------ grid helpers */

const cellKm = W.cellM / 1000
const cx = (W.nx * cellKm) / 2
const cz = (W.ny * cellKm) / 2
const bedLo = W.bedRangeM[0]
const toX = (col: number) => (col * cellKm - cx) * KM
const toZ = (row: number) => (row * cellKm - cz) * KM
const toY = (bedM: number) => ((bedM - bedLo) * VEX) / 1000

type Built = { terrain: BufferGeometry; water: BufferGeometry; waterWet: Int32Array; stride: number }

/** Wrap the worker's arrays in geometry: no per-vertex work on the main thread. */
function buildValley(a: ValleyArrays): Built {
  const terrain = new BufferGeometry()
  terrain.setAttribute('position', new BufferAttribute(a.position, 3))
  terrain.setAttribute('normal', new BufferAttribute(a.normal, 3))
  terrain.setAttribute('aIn', new BufferAttribute(a.inside, 1))
  terrain.setIndex(new BufferAttribute(a.terrainIndex, 1))
  const water = new BufferGeometry()
  water.setAttribute('position', new BufferAttribute(a.waterPosition, 3))
  const depth = new BufferAttribute(new Float32Array(a.waterWet.length), 1)
  depth.setUsage(DynamicDrawUsage)
  water.setAttribute('aDepth', depth)
  water.setIndex(new BufferAttribute(a.waterIndex, 1))
  return { terrain, water, waterWet: a.waterWet, stride: a.stride }
}

function groundMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Color(readToken('abyss-raised')) },
      uSky: { value: new Color(readToken('foam-soft')) },
      uGround: { value: new Color(readToken('abyss')) },
      uLine: { value: new Color(readToken('graticule')) },
      uLightDir: { value: new Vector3(-6, 14, 9).normalize() },
      uStepY: { value: (2 * VEX) / 1000 },
      uHalf: { value: [cx * KM, cz * KM] },
    },
    vertexShader: /* glsl */ `
      attribute float aIn;
      varying vec3 vN; varying vec3 vP; varying float vDepth; varying float vIn;
      void main() {
        vN = normal; vP = position; vIn = aIn;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uLine;
      uniform vec3 uLightDir; uniform float uStepY; uniform float uHalf[2];
      varying vec3 vN; varying vec3 vP; varying float vDepth; varying float vIn;
      void main() {
        vec3 n = normalize(vN);
        // Survey isolines every 2 m of real elevation, index line every 10 m,
        // inside the modelled area only.
        float h = vP.y / uStepY;
        float fw = fwidth(h);
        float l = 1.0 - smoothstep(0.0, fw * 1.2, abs(fract(h - 0.5) - 0.5));
        float idx = 1.0 - smoothstep(0.0, fw * 1.6, abs(fract(h / 5.0 - 0.5) - 0.5) * 5.0);
        float crowd = 1.0 - smoothstep(0.25, 0.6, fw);
        float inside = step(0.5, vIn);
        vec3 albedo = mix(uBase, uLine, (l * 0.16 + idx * 0.2) * crowd * inside);
        albedo = mix(uGround * 1.15, albedo, 0.35 + 0.65 * inside);
        vec3 hemi = mix(uGround, uSky, 0.5 * n.y + 0.5) * 0.9;
        vec3 c = albedo / 3.14159 * (hemi + vec3(1.4) * max(dot(n, uLightDir), 0.0));
        c = mix(c, uGround, smoothstep(90.0, 170.0, vDepth));
        // Dissolve the edges of the grid into the background, so the ground
        // does not read as a slab.
        float edge = min(uHalf[0] - abs(vP.x), uHalf[1] - abs(vP.z));
        c = mix(uGround, c, smoothstep(0.0, 3.0, edge));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

function waterMaterial(q: Quality, uTime: { value: number }) {
  const detail = q.tier === 'low' ? 0 : 1
  return new ShaderMaterial({
    defines: { DETAIL: detail },
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uTime,
      uVex: { value: VEX / 1000 },
      uShallow: { value: new Color(readToken('w1')) },
      uMid: { value: new Color(readToken('w3')) },
      uDeep: { value: new Color(readToken('w5')) },
      uSky: { value: new Color(readToken('foam-soft')).lerp(new Color(readToken('abyss')), 0.45) },
      uFoam: { value: new Color(readToken('foam')) },
      uFog: { value: new Color(readToken('abyss')) },
      uLightDir: { value: new Vector3(-6, 14, 9).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aDepth;
      uniform float uVex;
      varying float vDepth; varying vec3 vWorld; varying float vViewZ;
      void main() {
        vDepth = aDepth;
        vWorld = vec3(position.x, position.y + aDepth * uVex, position.z);
        vec4 mv = viewMatrix * vec4(vWorld, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
      uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uFog; uniform vec3 uLightDir;
      varying float vDepth; varying vec3 vWorld; varying float vViewZ;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      vec2 grad(vec2 p) {
        const float e = 0.08;
        return vec2(noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0)), noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e))) / (2.0 * e);
      }
      void main() {
        // Depth from the model: under 3 cm counts as dry.
        if (vDepth < 0.03) discard;
        vec2 p = vWorld.xz * 9.0;
        vec2 g = grad(p + vec2(uTime * 0.11, uTime * 0.07));
        #if DETAIL == 1
          g += 0.5 * grad(p * 2.3 - vec2(uTime * 0.17, -uTime * 0.05));
        #endif
        vec3 n = normalize(vec3(-g.x * 0.12, 1.0, -g.y * 0.12));
        vec3 V = normalize(cameraPosition - vWorld);
        // The page's bathymetric ramp by modelled depth (metres).
        float t = sqrt(clamp(vDepth / 12.0, 0.0, 1.0));
        vec3 body = mix(uShallow, uMid, smoothstep(0.0, 0.5, t));
        body = mix(body, uDeep, smoothstep(0.5, 1.0, t));
        float slope = dot(n, normalize(vec3(-0.6, 0.5, 0.6)));
        vec3 c = body * (0.6 + 0.45 * slope);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        c = mix(c, uSky, fres * 0.5);
        c += vec3(0.35) * pow(max(dot(reflect(-uLightDir, n), V), 0.0), 60.0);
        #if DETAIL == 1
          float shore = 1.0 - smoothstep(0.03, 0.25, vDepth);
          c = mix(c, uFoam, shore * 0.55 * (0.5 + 0.5 * noise(p * 3.0 + uTime * 0.3)));
        #endif
        c = mix(c, uFog, smoothstep(90.0, 170.0, vViewZ));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/* --------------------------------------------- gauges and section lines */

/** Local downstream direction at a section, from its neighbours, in grid units. */
function dirAt(i: number) {
  const a = sections[Math.max(0, i - 1)].grid
  const b = sections[Math.min(sections.length - 1, i + 1)].grid
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l = Math.hypot(dx, dz) || 1
  return [dx / l, dz / l] as const
}

function groundAt(ground: Float32Array, col: number, row: number) {
  const c = Math.max(0, Math.min(W.nx - 1, Math.round(col)))
  const r = Math.max(0, Math.min(W.ny - 1, Math.round(row)))
  return ground[r * W.nx + c]
}

const towerAnchor = stormGauges.map(() => new Vector3())

function Gauges({ ground, q }: { ground: Float32Array; q: Quality }) {
  const built = useMemo(() => {
    const well = new CylinderGeometry(0.06, 0.07, 1, q.radialSegments)
    const hut = new BoxGeometry(0.18, 0.12, 0.18)
    const concrete = new MeshLambertMaterial({ color: new Color(readToken('paper-line')) })
    const roof = new MeshLambertMaterial({ color: new Color(readToken('paper')) })
    const wells = new InstancedMesh(well, concrete, stormGauges.length)
    const huts = new InstancedMesh(hut, roof, stormGauges.length)
    const o = new Object3D()
    stormGauges.forEach((g, i) => {
      const k = sections.findIndex((s) => s.id === g.id)
      const [dx, dz] = dirAt(k)
      const s: Section = sections[k]
      const off = s.width_m / 2 / W.cellM + 2.5
      const col = s.grid[0] - dz * off
      const row = s.grid[1] + dx * off
      const gy = toY(groundAt(ground, col, row))
      const h = 0.55
      o.position.set(toX(col), gy + h / 2, toZ(row))
      o.scale.set(1, h, 1)
      o.updateMatrix()
      wells.setMatrixAt(i, o.matrix)
      o.position.set(toX(col), gy + h + 0.06, toZ(row))
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      huts.setMatrixAt(i, o.matrix)
      towerAnchor[i].set(toX(col), gy + h + 0.3, toZ(row))
    })
    return { wells, huts, dispose: [well, hut, concrete, roof] }
  }, [ground, q.radialSegments])
  useEffect(() => () => built.dispose.forEach((d) => d.dispose()), [built])
  return (
    <group>
      <primitive object={built.wells} />
      <primitive object={built.huts} />
    </group>
  )
}

/** Every ungauged section: a survey line across the river and two pins. No reading. */
function SectionLines({ ground }: { ground: Float32Array }) {
  const built = useMemo(() => {
    const pts: number[] = []
    const pins: [number, number, number][] = []
    sections.forEach((s, i) => {
      if (s.gauged) return
      const [dx, dz] = dirAt(i)
      const half = s.width_m / 2 / W.cellM + 1.5
      const a = [s.grid[0] - dz * half, s.grid[1] + dx * half]
      const b = [s.grid[0] + dz * half, s.grid[1] - dx * half]
      const y = toY(Math.max(groundAt(ground, a[0], a[1]), groundAt(ground, b[0], b[1]))) + 0.03
      const A: [number, number, number] = [toX(a[0]), y, toZ(a[1])]
      const B: [number, number, number] = [toX(b[0]), y, toZ(b[1])]
      pts.push(...A, ...B)
      pins.push(A, B)
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    const m = new LineBasicMaterial({ color: new Color(readToken('foam-soft')), transparent: true, opacity: 0.85 })
    const pinGeo = new BoxGeometry(0.03, 0.14, 0.03)
    const pinMat = new MeshLambertMaterial({ color: new Color(readToken('foam-soft')) })
    const mesh = new InstancedMesh(pinGeo, pinMat, pins.length)
    const o = new Object3D()
    pins.forEach((p, i) => {
      o.position.set(p[0], p[1] + 0.07, p[2])
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    return { g, m, mesh, dispose: [g, m, pinGeo, pinMat] }
  }, [ground])
  useEffect(() => () => built.dispose.forEach((d) => d.dispose()), [built])
  return (
    <group>
      <lineSegments geometry={built.g} material={built.m} />
      <primitive object={built.mesh} />
    </group>
  )
}

/* --------------------------------------------------------- gauge boards */

const boardEls: (HTMLDivElement | null)[] = []
const boardStage: (HTMLSpanElement | null)[] = []
const boardFlow: (HTMLSpanElement | null)[] = []

function BoardProjector() {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const t = useSite.getState().heroTime
    towerAnchor.forEach((a, i) => {
      const el = boardEls[i]
      if (!el) return
      v.copy(a).project(camera)
      const inside = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      el.style.visibility = inside ? 'visible' : 'hidden'
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`
      const id = stormGauges[i].id
      const s = boardStage[i]
      const f = boardFlow[i]
      if (s) s.textContent = `${fmt(depthAt(id, t), 2)} m`
      const qq = dischargeAt(id, t)
      if (f) f.textContent = qq == null ? '' : `${fmt(qq, 0)} m³/s`
    })
  })
  return null
}

function GaugeBoards() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ contain: 'strict' }} aria-hidden="true">
      {stormGauges.map((g, i) => (
        <div
          key={g.id}
          ref={(el) => {
            boardEls[i] = el
          }}
          className="absolute left-0 top-0 whitespace-nowrap border-hair border-foam-soft bg-abyss-raised px-1.5 py-0.5 text-micro text-foam"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          <span className="num">{g.name}</span> <span className="text-foam-soft">{g.role}</span>
          <br />
          <span
            className="num"
            ref={(el) => {
              boardStage[i] = el
            }}
          />
          <span
            className="num ml-2 text-foam-soft"
            ref={(el) => {
              boardFlow[i] = el
            }}
          />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- camera */

const scrollState = { p: 0 }

function CameraRig({ q }: { q: Quality }) {
  const { camera, gl, size, invalidate } = useThree()
  const drag = useRef({ az: 0, pol: 0, active: false, x: 0, y: 0, mouse: false })
  const reduced = useSite((s) => s.reducedMotion)
  const cur = useRef({ init: false, target: new Vector3() })

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
      d.az = MathUtils.clamp(d.az - (e.clientX - d.x) * 0.005, -0.8, 0.8)
      if (d.mouse) d.pol = MathUtils.clamp(d.pol + (e.clientY - d.y) * 0.004, -0.3, 0.3)
      d.x = e.clientX
      d.y = e.clientY
      invalidate()
    }
    const up = () => (drag.current.active = false)
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
    const overlay = typeof window !== 'undefined' && window.innerWidth >= 1100
    const coupled = q.scrollCamera && !reduced
    const p = coupled ? MathUtils.clamp(scrollState.p, 0, 1) * 0.6 : 0
    const target = new Vector3(0, 0.3, 0.4)
    // Fit the valley's 18 km width; the river runs south-west to north-east,
    // and the camera stands to the south-east looking across it.
    const halfH = Math.tan(MathUtils.degToRad(15))
    const fit = 9.5 / (halfH * Math.max(0.55, aspect))
    // Portrait screens back off further so all four gauges stay in view.
    const radius = overlay ? Math.min(70, fit * 1.75) : Math.min(110, fit * (aspect < 1 ? 1.6 : 1.25) + 4)
    const az = 0.55 + drag.current.az - p * 0.2
    const pol = 0.9 + drag.current.pol - p * 0.1
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
    const shift = overlay && aspect > 1.25 ? Math.round(size.width * Math.min(0.22, (aspect - 1.05) * 0.3)) : 0
    const lift = overlay && aspect > 1.25 ? Math.round(size.height * 0.15) : 0
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

/*
  Owns flood time. Advances it on the first pass, applies timeline seeks, and
  writes the model's depth at every water vertex, interpolated between the
  two-hourly frames.
*/
function FloodClock({ d, built, uTime }: { d: Data; built: Built; uTime: { value: number } }) {
  const invalidate = useThree((s) => s.invalidate)
  const t = useRef(useSite.getState().heroTime)
  const lastPush = useRef(0)
  const lastH = useRef(-1)
  const reduced = useSite((s) => s.reducedMotion)
  const step = W.frameHours.length > 1 ? W.frameHours[1] - W.frameHours[0] : 1
  const nFrames = W.frameHours.length

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
    if (reduced) t.current = holdHour
    else if (seek !== null) t.current = seek
    else if (st.heroPlaying) {
      t.current = Math.min(lastHour, t.current + Math.min(dt, 0.1) * HOURS_PER_SEC)
      if (t.current >= lastHour) st.setHeroSettled(true)
    }
    const h = t.current
    if (Math.abs(h - lastH.current) > 1e-3) {
      lastH.current = h
      const fpos = Math.min(nFrames - 1, h / step)
      const f0 = Math.floor(fpos)
      const f1 = Math.min(nFrames - 1, f0 + 1)
      const w = fpos - f0
      const attr = built.water.getAttribute('aDepth') as BufferAttribute
      const arr = attr.array as Float32Array
      const nw = W.nWet
      const s = W.depthStepM
      for (let k = 0; k < built.waterWet.length; k++) {
        const j = built.waterWet[k]
        arr[k] = j < 0 ? 0 : (d.flood[f0 * nw + j] * (1 - w) + d.flood[f1 * nw + j] * w) * s
      }
      attr.needsUpdate = true
    }
    if (!reduced && st.heroPlaying) uTime.value += Math.min(dt, 0.1)
    if (state.clock.elapsedTime - lastPush.current > 0.08 || seek !== null) {
      lastPush.current = state.clock.elapsedTime
      if (Math.abs(st.heroTime - h) > 0.02) st.setHeroTime(h)
    }
  })
  return null
}

/* ----------------------------------------------------------------- scene */

function Scene({ d, q }: { d: Data; q: Quality }) {
  const built = useMemo(() => buildValley(d.a), [d])
  const ground = d.a.ground
  const uTime = useMemo(() => ({ value: 0 }), [])
  const mats = useMemo(() => ({ ground: groundMaterial(), water: waterMaterial(q, uTime) }), [q, uTime])
  useEffect(
    () => () => {
      built.terrain.dispose()
      built.water.dispose()
      mats.ground.dispose()
      mats.water.dispose()
    },
    [built, mats],
  )
  const abyss = readToken('abyss')
  return (
    <>
      <color attach="background" args={[abyss]} />
      <hemisphereLight args={[readToken('foam-soft'), abyss, 0.9]} />
      <directionalLight position={[-6, 14, 9]} intensity={1.4} />
      <mesh geometry={built.terrain} material={mats.ground} />
      <mesh geometry={built.water} material={mats.water} frustumCulled={false} />
      <SectionLines ground={ground} />
      <Gauges ground={ground} q={q} />
      <BoardProjector />
      <FloodClock d={d} built={built} uTime={uTime} />
      <CameraRig q={q} />
    </>
  )
}

export default function RiverScene() {
  const reduced = useSite((s) => s.reducedMotion)
  const playing = useSite((s) => s.heroPlaying)
  const q = getQuality()
  const d = useValley(q.tier === 'low' ? 2 : 1)
  const fallback = <FloodVideo className="h-full w-full lg:ml-auto lg:w-3/5 lg:py-16" />
  return (
    <div className="absolute inset-0">
      {d ? (
        <SceneCanvas
          name="hero"
          className="absolute inset-0"
          // One orchestrated moment: the flood's first pass. After it, the
          // scene redraws only when the reader drags the timeline or the camera.
          frameloop={playing && !reduced ? 'always' : 'demand'}
          camera={{ fov: 30, near: 0.5, far: 220, position: [12, 14, 18] }}
          touchAction="pan-y"
          wrapperProps={{ role: 'img', 'aria-label': sceneLabel }}
          fallback={fallback}
        >
          <Scene d={d} q={q} />
        </SceneCanvas>
      ) : null}
      {d && hasWebGL() && <GaugeBoards />}
    </div>
  )
}
