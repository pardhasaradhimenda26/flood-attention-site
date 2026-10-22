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
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { SceneCanvas } from './SceneCanvas'
import { getQuality, hasWebGL, type Quality } from './useAdaptiveQuality'
import {
  FLOW_SPEEDUP,
  W,
  depthAt,
  dischargeAt,
  gridAtChainage,
  holdHour,
  lastHour,
  sceneLabel,
  sections,
  stormGauges,
  type Section,
} from '../lib/storm'
import { readToken } from '../lib/tokens'
import { viewMarkers } from '../lib/viewMarker'
import { Locator } from '../components/Locator'
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

/**
 * flood: uint8 depth [frame, wet cell]; vel: int8 (east, north) [frame, wet
 * cell, 2]; img: the satellite imagery on the same grid, or null without it.
 */
type Data = { flood: Uint8Array; vel: Int8Array; img: ImageBitmap | null; a: ValleyArrays }

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
      const img = fetch(base + 'imagery.jpg')
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('imagery ' + r.status))))
        .then((b) => createImageBitmap(b))
        .catch(() => null)
      Promise.all([get('terrain.bin'), get('wet.bin'), get('flood.bin'), get('vel.bin'), img])
        .then(([t, w, f, v, bitmap]) => {
          if (alive)
            setD({
              flood: new Uint8Array(f),
              vel: new Int8Array(v),
              img: bitmap,
              a: buildValleyArrays(new Float32Array(t), new Uint32Array(w), p),
            })
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
    worker.onmessage = (
      e: MessageEvent<{ ok: true; flood: Uint8Array; vel: Int8Array; img: ImageBitmap | null; a: ValleyArrays } | { ok: false }>,
    ) => {
      worker.terminate()
      if (!alive) return
      if (e.data.ok) setD({ flood: e.data.flood, vel: e.data.vel, img: e.data.img, a: e.data.a })
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
  const vel = new BufferAttribute(new Float32Array(a.waterWet.length * 2), 2)
  vel.setUsage(DynamicDrawUsage)
  water.setAttribute('aVel', vel)
  water.setIndex(new BufferAttribute(a.waterIndex, 1))
  return { terrain, water, waterWet: a.waterWet, stride: a.stride }
}

/*
  The ground. With imagery (Sentinel-2 cloudless 2016, warped onto the model's
  UTM grid; context only), the landscape is the real one, shaded by the
  exaggerated relief so the valley reads in 3D. Without it, the survey style:
  a flat tone with 2 m isolines inside the modelled area.
*/
function groundMaterial(img: Texture | null) {
  return new ShaderMaterial({
    defines: { HAS_IMG: img ? 1 : 0 },
    uniforms: {
      uImg: { value: img },
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
      uniform sampler2D uImg;
      uniform vec3 uBase; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uLine;
      uniform vec3 uLightDir; uniform float uStepY; uniform float uHalf[2];
      varying vec3 vN; varying vec3 vP; varying float vDepth; varying float vIn;
      void main() {
        vec3 n = normalize(vN);
        #if HAS_IMG == 1
          // The grid's north-west corner is (-half x, -half z); the image is north up.
          vec2 uv = vec2((vP.x + uHalf[0]) / (2.0 * uHalf[0]), (vP.z + uHalf[1]) / (2.0 * uHalf[1]));
          vec3 albedo = texture2D(uImg, uv).rgb;
          vec3 c = albedo * (0.72 + 0.5 * max(dot(n, uLightDir), 0.0));
        #else
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
        #endif
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

/*
  The water surface, from the model and nothing else: its height is the bed
  plus the modelled depth, and its texture moves with the modelled velocity.

  Flow map: one ripple pattern, advected by each point's velocity, drawn twice
  half a period apart and cross-faded, so each copy can restart without the
  restart showing. Faster water is rougher and breaks white in streaks drawn
  out along the current (from about 1 m/s; the model's channel runs up to
  4.4 m/s). The wet/dry edge is a thin band of shallow, lighter water. Colour
  is the floodwater's own (silt tokens), darker where deeper.
*/
function waterMaterial(q: Quality, uTime: { value: number }) {
  const detail = q.tier === 'low' ? 0 : 1
  return new ShaderMaterial({
    defines: { DETAIL: detail },
    // The edge fades over the first decimetres of depth, so the 50 m cells'
    // steps do not show as a hard outline.
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uTime,
      uVex: { value: VEX / 1000 },
      // Real metres per second to world units (km) per second on screen.
      uAdvect: { value: (FLOW_SPEEDUP / 1000) * KM },
      uShallow: { value: new Color(readToken('silt-1')) },
      uMid: { value: new Color(readToken('silt-2')) },
      uDeep: { value: new Color(readToken('silt-3')) },
      uSky: { value: new Color(readToken('foam-soft')).lerp(new Color(readToken('abyss')), 0.12) },
      uFoam: { value: new Color(readToken('foam')) },
      uFog: { value: new Color(readToken('abyss')) },
      uLightDir: { value: new Vector3(-6, 14, 9).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aDepth;
      attribute vec2 aVel;
      uniform float uVex;
      varying float vDepth; varying vec3 vWorld; varying float vViewZ; varying vec2 vFlow;
      void main() {
        vDepth = aDepth;
        // The dataset's velocity is (east, north); the world's north is -z.
        vFlow = vec2(aVel.x, -aVel.y);
        vWorld = vec3(position.x, position.y + aDepth * uVex, position.z);
        vec4 mv = viewMatrix * vec4(vWorld, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uAdvect;
      uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
      uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uFog; uniform vec3 uLightDir;
      varying float vDepth; varying vec3 vWorld; varying float vViewZ; varying vec2 vFlow;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      vec2 grad(vec2 p) {
        const float e = 0.08;
        return vec2(noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0)), noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e))) / (2.0 * e);
      }
      const float PERIOD = 2.5;   // seconds per flow-map cycle
      const float SCALE = 30.0;   // pattern units per km: ripples about 35 m across
      void main() {
        // Under 3 cm of modelled depth counts as dry.
        if (vDepth < 0.03) discard;
        float speed = length(vFlow);
        vec2 dir = speed > 1e-4 ? vFlow / speed : vec2(1.0, 0.0);
        float ph0 = fract(uTime / PERIOD);
        float ph1 = fract(uTime / PERIOD + 0.5);
        float w = abs(1.0 - 2.0 * ph0);
        vec2 p = vWorld.xz * SCALE;
        vec2 adv = vFlow * uAdvect * PERIOD * SCALE;
        vec2 a0 = p - adv * ph0;
        vec2 a1 = p - adv * ph1 + vec2(17.3, 5.9);
        vec2 g = mix(grad(a0), grad(a1), w);
        #if DETAIL == 1
          g += 0.45 * mix(grad(a0 * 2.6), grad(a1 * 2.6), w);
        #endif
        float rough = 0.09 + 0.22 * smoothstep(0.2, 2.0, speed);
        vec3 n = normalize(vec3(-g.x * rough, 1.0, -g.y * rough));
        vec3 V = normalize(cameraPosition - vWorld);

        // Silt-laden water, darker with depth (metres).
        float t = clamp(vDepth / 8.0, 0.0, 1.0);
        vec3 body = mix(uShallow, uMid, smoothstep(0.0, 0.3, t));
        body = mix(body, uDeep, smoothstep(0.3, 1.0, t));
        vec3 c = body * (0.5 + 0.35 * max(dot(n, uLightDir), 0.0));
        // Water reads as water by what it reflects: the sky, more of it at
        // grazing angles, broken up by the ripples; and the sun's glint.
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        float skyLight = 0.75 + 0.25 * n.x;
        c = mix(c, uSky * skyLight, 0.1 + fres * 0.7);
        vec3 R = reflect(-uLightDir, n);
        c += vec3(0.55) * pow(max(dot(R, V), 0.0), 120.0) + vec3(0.06) * pow(max(dot(R, V), 0.0), 8.0);

        // White water, in streaks drawn out along the current, where it is fast.
        vec2 side = vec2(-dir.y, dir.x);
        vec2 s0 = vec2(dot(a0, dir) * 0.45, dot(a0, side) * 2.2);
        vec2 s1 = vec2(dot(a1, dir) * 0.45, dot(a1, side) * 2.2);
        float streak = mix(noise(s0), noise(s1), w);
        float white = smoothstep(0.8, 2.4, speed) * smoothstep(0.58, 0.9, streak);
        c = mix(c, uFoam, white * 0.6);

        // The wet edge: a thin band of shallow, lighter water.
        float edge = 1.0 - smoothstep(0.03, 0.2, vDepth);
        c = mix(c, uShallow * 1.12, edge * 0.55);

        c = mix(c, uFog, smoothstep(90.0, 170.0, vViewZ));
        // Shallow sheet flow lets the ground show through; past half a metre it is opaque.
        gl_FragColor = vec4(c, smoothstep(0.03, 0.5, vDepth));
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
      const k = ungauged.indexOf(s)
      if (k >= 0) tagAnchor[k].set(B[0], B[1], B[2])
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
const boardRole: (HTMLSpanElement | null)[] = []
/** Board widths, measured once (reading layout every frame would force reflows). */
const boardW: number[] = []
const boardCompact = { current: false }
/** Ungauged sections: anchors and tags ("no gauge", with the place when no gauge shares it). */
const ungauged = sections.filter((s) => !s.gauged)
const tagAnchor = ungauged.map(() => new Vector3())
const tagEls: (HTMLDivElement | null)[] = []
const gaugePlaces = new Set(stormGauges.map((g) => g.place))
/** Below this canvas width the boards drop role and discharge (the gauge table carries them). */
const COMPACT_W = 640

function BoardProjector() {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const t = useSite.getState().heroTime
    // On a phone four full boards cannot fit along the valley without
    // covering each other: show name and depth only, and hang every second
    // board below its tower.
    const compact = size.width < COMPACT_W
    // On wide screens the text column lies over the left of the scene: no
    // board or tag is drawn under it.
    const clear = free.wide ? (2 * free.left) / Math.max(1, size.width) - 1 : -1.05
    if (compact !== boardCompact.current) {
      boardCompact.current = compact
      boardW.length = 0
    }
    towerAnchor.forEach((a, i) => {
      const el = boardEls[i]
      if (!el) return
      const role = boardRole[i]
      if (role) role.style.display = compact ? 'none' : ''
      const id = stormGauges[i].id
      const s = boardStage[i]
      const f = boardFlow[i]
      if (s) s.textContent = `${fmt(depthAt(id, t), 2)} m`
      const qq = dischargeAt(id, t)
      if (f) f.textContent = compact || qq == null ? '' : `${fmt(qq, 0)} m³/s`
      v.copy(a).project(camera)
      const inside = v.z < 1 && v.x > clear && v.x < 1.05 && Math.abs(v.y) < 1.05
      el.style.visibility = inside ? 'visible' : 'hidden'
      const below = compact && i % 2 === 1
      // Centred over its tower, but never reaching into the text column or off the right edge.
      const w = (boardW[i] ||= el.offsetWidth)
      const left = Math.min(
        Math.max(((v.x + 1) / 2) * size.width - w / 2, ((clear + 1) / 2) * size.width + 8),
        size.width - w - 8,
      )
      el.style.transform = `translate(${left}px, ${((1 - v.y) / 2) * size.height}px) translate(0, ${below ? '24px' : '-100%'})`
    })
    tagAnchor.forEach((a, i) => {
      const el = tagEls[i]
      if (!el) return
      v.copy(a).project(camera)
      const inside = !compact && v.z < 1 && v.x > clear && v.x < 1.02 && Math.abs(v.y) < 1.02
      el.style.visibility = inside ? 'visible' : 'hidden'
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, 6px)`
    })
  })
  return null
}

function GaugeBoards() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ contain: 'strict' }} aria-hidden="true">
      {ungauged.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => {
            tagEls[i] = el
          }}
          className="absolute left-0 top-0 whitespace-nowrap text-micro text-foam-soft"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          {s.place && !gaugePlaces.has(s.place) ? `${s.place} · ` : ''}no gauge
        </div>
      ))}
      {stormGauges.map((g, i) => (
        <div
          key={g.id}
          ref={(el) => {
            boardEls[i] = el
          }}
          className="absolute left-0 top-0 whitespace-nowrap border-hair border-foam-soft bg-abyss-raised px-1.5 py-0.5 text-micro text-foam"
          style={{ visibility: 'hidden', willChange: 'transform' }}
        >
          <span className="num">{g.name}</span>{' '}
          <span
            ref={(el) => {
              boardRole[i] = el
            }}
          >
            {g.place}
          </span>
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

/*
  The part of the canvas the valley can use, in canvas pixels. On wide screens
  the canvas fills the whole header, under the text and the timeline, and the
  header can be taller than the screen; the valley belongs right of the text,
  above the timeline and on screen. Elsewhere it is the whole canvas. Measured
  on resize and when those blocks change size, never per frame.
*/
const free = { left: 0, top: 0, right: 1, bottom: 1, wide: false }
function measureFree(canvas: HTMLCanvasElement) {
  const c = canvas.getBoundingClientRect()
  free.wide = window.innerWidth >= 1100
  free.left = 0
  free.top = 0
  free.right = c.width
  free.bottom = c.height
  if (!free.wide) return
  const text = document.getElementById('hero-text')?.getBoundingClientRect()
  const tl = document.getElementById('hero-timeline')?.getBoundingClientRect()
  if (text) free.left = Math.min(c.width * 0.6, Math.max(0, text.right - c.left + 24))
  free.top = 24
  free.right = c.width - 24
  const onScreen = window.innerHeight - (c.top + window.scrollY)
  free.bottom = Math.max(free.top + 100, Math.min(c.height, tl ? tl.top - c.top - 24 : c.height, onScreen - 24))
}

const flyFrom = sections.length ? stormGauges[0]?.section.s_m ?? sections[0].s_m : 0
const flyTo = sections.length ? stormGauges[stormGauges.length - 1]?.section.s_m ?? sections[sections.length - 1].s_m : 0
const smooth = (x: number) => x * x * (3 - 2 * x)

function CameraRig({ q, ground }: { q: Quality; ground: Float32Array }) {
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
    const remeasure = () => {
      measureFree(el)
      invalidate()
    }
    remeasure()
    const ro = new ResizeObserver(remeasure)
    ro.observe(el)
    for (const id of ['hero-text', 'hero-timeline']) {
      const b = document.getElementById(id)
      if (b) ro.observe(b)
    }
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
      ro.disconnect()
    }
  }, [gl, invalidate])

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const overlay = free.wide
    const coupled = q.scrollCamera && !reduced
    const p = coupled ? MathUtils.clamp(scrollState.p, 0, 1) * 0.6 : 0
    // The river runs south-west to north-east and the camera stands to the
    // south-east looking across it. On wide screens the reach (about 20 km
    // across the view) is fitted to the free rectangle, by width and by
    // height; elsewhere to the valley's 18 km width, portrait screens backing
    // off further so all four gauges stay in view.
    const halfH = Math.tan(MathUtils.degToRad(15))
    const fw = Math.max(1, free.right - free.left)
    const fh = Math.max(1, free.bottom - free.top)
    const fit = 9.5 / (halfH * Math.max(0.55, aspect))
    const overview = overlay
      ? Math.min(110, Math.max((20 * size.height) / (0.9 * fw * 2 * halfH), (8 * size.height) / (0.8 * fh * 2 * halfH)))
      : Math.min(110, fit * (aspect < 1 ? 1.6 : 1.25) + 4)
    // The flood's first pass is a flight down the valley, close enough to see
    // the water move, from the first gauge to the last; then back out to all
    // four. Reduced motion, a seek or the end of the pass gives the overview.
    const st = useSite.getState()
    const fly = st.heroPlaying && !reduced
    const target = new Vector3(0, 0.3, 0.4)
    let radius = overview
    let pol = 0.9 + drag.current.pol - p * 0.1
    if (fly) {
      const f = smooth(MathUtils.clamp(st.heroTime / lastHour, 0, 1))
      const [col, row] = gridAtChainage(flyFrom + (flyTo - flyFrom) * f)
      target.set(toX(col), toY(groundAt(ground, col, row)) + 0.15, toZ(row))
      radius = overview * (overlay ? 0.5 : aspect < 1 ? 0.32 : 0.45)
      pol = 1.0 + drag.current.pol
    }
    const az = 0.55 + drag.current.az - p * 0.2
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
    // Centre the view on the free rectangle.
    const ox = overlay ? -Math.round((free.left + free.right) / 2 - size.width / 2) : 0
    const oy = overlay ? -Math.round((free.top + free.bottom) / 2 - size.height / 2) : 0
    const view = cam.view
    if ((ox || oy) && (!view || !view.enabled || view.offsetX !== ox || view.offsetY !== oy || view.fullWidth !== size.width || view.fullHeight !== size.height)) {
      cam.setViewOffset(size.width, size.height, ox, oy, size.width, size.height)
    } else if (!ox && !oy && view?.enabled) {
      cam.clearViewOffset()
    }
    if (k < 1 && cam.position.distanceToSquared(desired) > 1e-5) invalidate()
    if (viewMarkers.size) {
      // The locator's ring: where the camera looks, and roughly how much ground the view spans.
      const t = cur.current.target
      const col = (t.x / KM + cx) / cellKm
      const row = (t.z / KM + cz) / cellKm
      const span = (cam.position.distanceTo(t) * Math.tan(MathUtils.degToRad(15)) * Math.max(1, aspect)) / KM / cellKm
      const tf = `translate(${col.toFixed(1)} ${row.toFixed(1)}) scale(${Math.max(8, span).toFixed(1)})`
      viewMarkers.forEach((m) => m.setAttribute('transform', tf))
    }
  })
  return null
}

/* ----------------------------------------------------------------- clock */

/*
  Owns flood time. Advances it on the first pass, applies timeline seeks, and
  writes the model's depth and velocity at every water vertex, interpolated
  between the two-hourly frames.
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
      const vAttr = built.water.getAttribute('aVel') as BufferAttribute
      const varr = vAttr.array as Float32Array
      const nw = W.nWet
      const s = W.depthStepM
      const vs = W.velStepMs
      const o0 = f0 * nw
      const o1 = f1 * nw
      for (let k = 0; k < built.waterWet.length; k++) {
        const j = built.waterWet[k]
        if (j < 0) {
          arr[k] = 0
          varr[2 * k] = 0
          varr[2 * k + 1] = 0
          continue
        }
        arr[k] = (d.flood[o0 + j] * (1 - w) + d.flood[o1 + j] * w) * s
        varr[2 * k] = (d.vel[2 * (o0 + j)] * (1 - w) + d.vel[2 * (o1 + j)] * w) * vs
        varr[2 * k + 1] = (d.vel[2 * (o0 + j) + 1] * (1 - w) + d.vel[2 * (o1 + j) + 1] * w) * vs
      }
      attr.needsUpdate = true
      vAttr.needsUpdate = true
    }
    // The current keeps moving after the first pass; reduced motion holds it.
    if (!reduced) uTime.value += Math.min(dt, 0.1)
    if (state.clock.elapsedTime - lastPush.current > 0.08 || seek !== null) {
      lastPush.current = state.clock.elapsedTime
      if (Math.abs(st.heroTime - h) > 0.02) st.setHeroTime(h)
    }
  })
  return null
}

/** After the first pass the current keeps moving: redraw at 30 frames a second. */
function FlowTicker({ on }: { on: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => invalidate(), 33)
    return () => window.clearInterval(id)
  }, [on, invalidate])
  return null
}

/* ----------------------------------------------------------------- scene */

function Scene({ d, q }: { d: Data; q: Quality }) {
  const playing = useSite((s) => s.heroPlaying)
  const reduced = useSite((s) => s.reducedMotion)
  const built = useMemo(() => buildValley(d.a), [d])
  const ground = d.a.ground
  const uTime = useMemo(() => ({ value: 0 }), [])
  const img = useMemo(() => {
    if (!d.img) return null
    // An ImageBitmap is never flipped on upload: row 0 is north, at v = 0.
    const t = new Texture(d.img)
    t.colorSpace = SRGBColorSpace
    t.flipY = false
    t.anisotropy = q.tier === 'high' ? 8 : 4
    t.needsUpdate = true
    return t
  }, [d, q.tier])
  const mats = useMemo(() => ({ ground: groundMaterial(img), water: waterMaterial(q, uTime) }), [q, uTime, img])
  useEffect(
    () => () => {
      built.terrain.dispose()
      built.water.dispose()
      mats.ground.dispose()
      mats.water.dispose()
      img?.dispose()
    },
    [built, mats, img],
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
      <CameraRig q={q} ground={ground} />
      <FlowTicker on={!playing && !reduced} />
    </>
  )
}

export default function RiverScene() {
  const reduced = useSite((s) => s.reducedMotion)
  const playing = useSite((s) => s.heroPlaying)
  const q = getQuality()
  // Every second cell (176 × 160 vertices) unless the device is high tier:
  // on a phone the full grid is denser than the pixels it covers.
  const d = useValley(q.tier === 'high' ? 1 : 2)
  const fallback = <FloodVideo className="h-full w-full lg:ml-auto lg:w-3/5 lg:pb-[28rem] lg:pt-16" />
  return (
    <div className="absolute inset-0">
      {d ? (
        <SceneCanvas
          name="hero"
          className="absolute inset-0"
          // The flood's first pass runs every frame; after it the current
          // keeps flowing at 30 frames a second (FlowTicker), and reduced
          // motion redraws only on input.
          frameloop={playing && !reduced ? 'always' : 'demand'}
          camera={{ fov: 30, near: 0.5, far: 220, position: [12, 14, 18] }}
          touchAction="pan-y"
          wrapperProps={{ role: 'img', 'aria-label': sceneLabel }}
          fallback={fallback}
        >
          <Scene d={d} q={q} />
        </SceneCanvas>
      ) : null}
      {d && hasWebGL() && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 lg:block"
          style={{ background: 'linear-gradient(90deg, var(--abyss) 35%, color-mix(in srgb, var(--abyss) 0%, transparent))' }}
        />
      )}
      {d && hasWebGL() && <GaugeBoards />}
      {d && hasWebGL() && <Locator compact className="absolute right-3 top-3 w-28 sm:w-36 lg:hidden" />}
    </div>
  )
}
