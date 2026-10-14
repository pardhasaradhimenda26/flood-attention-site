import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
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
import { nodes } from '../data/network'
import { SceneCanvas } from './SceneCanvas'
import { getQuality, hasWebGL, type Quality } from './useAdaptiveQuality'
import { BANK_H, channelAt, terrainBounds, terrainHeight, thalwegAt } from '../lib/terrain'
import {
  depthAt,
  dischargeAt,
  holdHour,
  lastHour,
  maxRain,
  nodeIndex,
  rainAt,
  STAGE_SCALE,
  sceneLabel,
  stormGauges,
  velocityAt,
} from '../lib/storm'
import { readToken } from '../lib/tokens'
import { useSite } from '../state'
import { NetworkPlan } from '../components/NetworkPlan'
import { fmt } from '../lib/format'

/*
  The hero: a river valley you can watch flood, driven hour by hour by one
  real storm from the dataset (lib/storm.ts). Design notes in
  docs/design-plan.md.

  Water depth is exaggerated (STAGE_SCALE, lib/storm.ts) so a 0.7 m flood is visible on a
  valley 22 units long; the scene label says so.
*/

const N = nodes.length
/** Storm hours per real second on the first pass (140 h in about 14 s). */
const HOURS_PER_SEC = 10

/* ------------------------------------------------------------ valley grid */

type Valley = {
  terrain: BufferGeometry
  water: BufferGeometry
}

/** One grid for ground and water: the water mesh keeps only cells near a channel. */
function buildValley(q: Quality): Valley {
  const { minX, maxX, minZ, maxZ } = terrainBounds
  const w = maxX - minX
  const d = maxZ - minZ
  const nx = q.terrainRes
  const nz = Math.round((nx * d) / w)
  const vx = nx + 1
  const vz = nz + 1
  const count = vx * vz
  const pos = new Float32Array(count * 3)
  const ground = new Float32Array(count)
  const thal = new Float32Array(count)
  const seg = new Float32Array(count * 3)
  const flow = new Float32Array(count * 3)
  const near = new Uint8Array(count)
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const k = j * vx + i
      const x = minX + (i / nx) * w
      const z = minZ + (j / nz) * d
      const c = channelAt(x, z)
      const y = terrainHeight(x, z, c)
      pos[k * 3] = x
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = z
      ground[k] = y
      thal[k] = thalwegAt(c)
      seg[k * 3] = nodeIndex.get(c.source) ?? 0
      seg[k * 3 + 1] = nodeIndex.get(c.target) ?? 0
      seg[k * 3 + 2] = c.t
      flow[k * 3] = c.dirX
      flow[k * 3 + 1] = c.dirZ
      flow[k * 3 + 2] = c.d / c.hw
      // Anything water could reach: the channel plus a floodplain margin.
      near[k] = c.d < c.hw + 1.4 ? 1 : 0
    }
  }
  const all: number[] = []
  const wet: number[] = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * vx + i
      const b = a + 1
      const c = a + vx
      const e = c + 1
      all.push(a, c, b, b, c, e)
      if (near[a] || near[b] || near[c] || near[e]) wet.push(a, c, b, b, c, e)
    }
  }
  const terrain = new BufferGeometry()
  terrain.setAttribute('position', new BufferAttribute(pos, 3))
  terrain.setIndex(all)
  terrain.computeVertexNormals()

  const water = new BufferGeometry()
  water.setAttribute('position', new BufferAttribute(pos, 3))
  water.setAttribute('aGround', new BufferAttribute(ground, 1))
  water.setAttribute('aThal', new BufferAttribute(thal, 1))
  water.setAttribute('aSeg', new BufferAttribute(seg, 3))
  water.setAttribute('aFlow', new BufferAttribute(flow, 3))
  water.setIndex(wet)
  return { terrain, water }
}

/* ---------------------------------------------------------------- ground */

function groundMaterial() {
  const { minX, maxX, minZ, maxZ } = terrainBounds
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Color(readToken('abyss-raised')) },
      uSky: { value: new Color(readToken('foam-soft')) },
      uGround: { value: new Color(readToken('abyss')) },
      uLine: { value: new Color(readToken('graticule')) },
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
        // Survey-chart isolines every 0.12 world units, index line every fifth.
        float h = vP.y / 0.12;
        float fw = fwidth(h);
        float l = 1.0 - smoothstep(0.0, fw * 1.2, abs(fract(h - 0.5) - 0.5));
        float idx = 1.0 - smoothstep(0.0, fw * 1.6, abs(fract(h / 5.0 - 0.5) - 0.5) * 5.0);
        float crowd = 1.0 - smoothstep(0.25, 0.6, fw);
        vec3 albedo = mix(uBase, uLine, (l * 0.14 + idx * 0.16) * crowd);
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
}

/* ----------------------------------------------------------------- water */

type WaterUniforms = {
  uStage: { value: Float32Array }
  uVel: { value: Float32Array }
  uTime: { value: number }
}

function waterMaterial(q: Quality, u: WaterUniforms) {
  // 0: one ripple sample, no flow map, no foam. 1: flow map and foam. 2: plus a second ripple scale.
  const detail = q.tier === 'low' ? 0 : q.tier === 'medium' ? 1 : 2
  return new ShaderMaterial({
    defines: { N_NODES: N, DETAIL: detail },
    uniforms: {
      ...u,
      uShallow: { value: new Color(readToken('w1')) },
      uMid: { value: new Color(readToken('w3')) },
      uDeep: { value: new Color(readToken('w5')) },
      // Sky seen in the water: the pale chart blue darkened toward the valley's own colour.
      uSky: { value: new Color(readToken('foam-soft')).lerp(new Color(readToken('abyss')), 0.45) },
      uFoam: { value: new Color(readToken('foam')) },
      uFog: { value: new Color(readToken('abyss')) },
      uLightDir: { value: new Vector3(-8, 14, 9).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aGround; attribute float aThal; attribute vec3 aSeg; attribute vec3 aFlow;
      uniform float uStage[N_NODES]; uniform float uVel[N_NODES];
      varying float vDepth; varying vec3 vWorld; varying vec2 vDir; varying float vSpeed; varying float vViewZ;
      void main() {
        int a = int(aSeg.x + 0.5);
        int b = int(aSeg.y + 0.5);
        float stage = mix(uStage[a], uStage[b], aSeg.z);
        float vel = mix(uVel[a], uVel[b], aSeg.z);
        float surf = aThal + stage;
        // Depth of water over the ground here. Negative = dry; the fragment
        // shader discards it, which is what draws the shoreline.
        vDepth = surf - aGround;
        vWorld = vec3(position.x, surf, position.z);
        vDir = aFlow.xy;
        // Fastest mid-channel, slowing toward the banks and over the floodplain.
        vSpeed = vel * clamp(1.0 - 0.75 * aFlow.z * aFlow.z, 0.15, 1.0);
        vec4 mv = viewMatrix * vec4(vWorld, 1.0);
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
      uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uFog; uniform vec3 uLightDir;
      varying float vDepth; varying vec3 vWorld; varying vec2 vDir; varying float vSpeed; varying float vViewZ;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      vec2 grad(vec2 p) {
        const float e = 0.08;
        return vec2(noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0)), noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e))) / (2.0 * e);
      }
      // Ripple slope at p, advected along the reach: two phases offset by half
      // a cycle and cross-faded, so the pattern moves without stretching.
      vec2 flowRipple(vec2 p, float scale, float rate) {
        float t = uTime * rate;
        float p0 = fract(t);
        float p1 = fract(t + 0.5);
        float w = abs(1.0 - 2.0 * p0);
        vec2 drift = vDir * vSpeed * 0.9;
        vec2 g0 = grad((p - drift * p0) * scale);
        vec2 g1 = grad((p - drift * p1) * scale + 17.3);
        return mix(g0, g1, 1.0 - w);
      }

      void main() {
        if (vDepth <= 0.0) discard;
        vec2 p = vWorld.xz;
        vec2 g;
        #if DETAIL == 0
          g = grad(p * 7.0 + uTime * 0.05);
        #else
          g = flowRipple(p, 7.0, 0.35);
          #if DETAIL == 2
            g += 0.5 * flowRipple(p + 3.1, 17.0, 0.6);
          #endif
        #endif
        vec3 n = normalize(vec3(-g.x * 0.22, 1.0, -g.y * 0.22));
        vec3 V = normalize(cameraPosition - vWorld);

        // Bathymetric ramp with exponential absorption: pale shallows, dark channel.
        float absorb = 1.0 - exp(-vDepth * 11.0);
        vec3 body = mix(uShallow, uMid, smoothstep(0.0, 0.35, absorb));
        body = mix(body, uDeep, smoothstep(0.35, 0.95, absorb));
        // Ripple shading carries the movement: the surface darkens and lightens as it slopes.
        float slope = dot(n, normalize(vec3(-0.6, 0.5, 0.6)));
        vec3 c = body * (0.55 + 0.5 * slope);

        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        c = mix(c, uSky, fres * 0.6);
        c += vec3(0.45) * pow(max(dot(reflect(-uLightDir, n), V), 0.0), 60.0);

        #if DETAIL >= 1
          // Foam: a fringe on the shoreline and the shallows, and streaks where the current is fast.
          float shore = 1.0 - smoothstep(0.0, 0.018, vDepth);
          float churn = smoothstep(1.1, 1.9, vSpeed) * smoothstep(0.55, 0.9, noise(p * 13.0 - vDir * uTime * vSpeed * 1.4));
          float foam = clamp(shore * (0.45 + 0.55 * noise(p * 24.0 + uTime * 0.4)) + churn * 0.6, 0.0, 1.0);
          c = mix(c, uFoam, foam * 0.8);
        #endif

        c = mix(c, uFog, smoothstep(26.0, 60.0, vViewZ));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/* ------------------------------------------------------------------ rain */

const RAIN_COUNT = { low: 1500, medium: 4000, high: 8000 } as const

function buildRain(q: Quality) {
  const count = RAIN_COUNT[q.tier]
  const weights = nodes.map((n) => n.localAreaKm2)
  const total = weights.reduce((a, b) => a + b, 0)
  // Deterministic: the same storm falls on every load.
  let s = 1234567
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const pos = new Float32Array(count * 3)
  const ground = new Float32Array(count)
  const nodeIdx = new Float32Array(count)
  const seed = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    let r = rnd() * total
    let k = 0
    while (k < N - 1 && r > weights[k]) r -= weights[k++]
    const n = nodes[k]
    const a = rnd() * Math.PI * 2
    const rad = Math.sqrt(rnd()) * 1.7
    const x = n.pos[0] + Math.cos(a) * rad
    const z = n.pos[2] + Math.sin(a) * rad
    pos[i * 3] = x
    pos[i * 3 + 2] = z
    ground[i] = terrainHeight(x, z)
    nodeIdx[i] = k
    seed[i * 3] = rnd()
    seed[i * 3 + 1] = rnd()
    seed[i * 3 + 2] = rnd()
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aGround', new BufferAttribute(ground, 1))
  g.setAttribute('aNode', new BufferAttribute(nodeIdx, 1))
  g.setAttribute('aSeed', new BufferAttribute(seed, 3))
  return g
}

function rainMaterial(u: { uRain: { value: Float32Array }; uTime: { value: number }; uPx: { value: number } }) {
  return new ShaderMaterial({
    defines: { N_NODES: N },
    transparent: true,
    depthWrite: false,
    uniforms: { ...u, uMax: { value: maxRain }, uCol: { value: new Color(readToken('foam')) } },
    vertexShader: /* glsl */ `
      attribute float aGround; attribute float aNode; attribute vec3 aSeed;
      uniform float uRain[N_NODES]; uniform float uMax; uniform float uTime; uniform float uPx;
      varying float vA;
      void main() {
        // Each drop belongs to one cross-section and shows only while the
        // dataset rains there; density follows that hour's rainfall.
        float r = uRain[int(aNode + 0.5)] / uMax;
        float on = step(aSeed.z, r * 1.6) * step(0.001, r);
        float y = aGround + 0.15 + 2.6 * (1.0 - fract(aSeed.y + uTime * (0.8 + 0.3 * aSeed.x)));
        vec4 mv = viewMatrix * vec4(position.x, y, position.z, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = on * uPx * 90.0 / max(1.0, -mv.z);
        vA = on * (0.35 + 0.4 * aSeed.x) * (1.0 - smoothstep(30.0, 60.0, -mv.z));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (abs(c.x) > 0.06) discard;
        gl_FragColor = vec4(uCol, vA * (1.0 - abs(c.y) * 2.0));
        #include <colorspace_fragment>
      }`,
  })
}

/* ------------------------------------------------- gauges and section lines */

function sideOf(id: string) {
  const n = nodes[nodeIndex.get(id)!]
  const c = channelAt(n.pos[0], n.pos[2])
  // Perpendicular to the flow, on the left bank looking downstream.
  return { n, c, px: -c.dirZ, pz: c.dirX }
}

const towerAnchor = stormGauges.map(() => new Vector3())

function Gauges({ q }: { q: Quality }) {
  const built = useMemo(() => {
    const well = new CylinderGeometry(0.085, 0.1, 1, q.radialSegments)
    const hut = new BoxGeometry(0.26, 0.17, 0.26)
    const staff = new BoxGeometry(0.05, 1, 0.015)
    const concrete = new MeshLambertMaterial({ color: new Color(readToken('paper-line')) })
    const roof = new MeshLambertMaterial({ color: new Color(readToken('paper')) })
    const staffMat = new ShaderMaterial({
      uniforms: { uLight: { value: new Color(readToken('foam')) }, uDark: { value: new Color(readToken('ink')) } },
      vertexShader: /* glsl */ `varying float vY; void main() { vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uLight; uniform vec3 uDark; varying float vY;
        void main() { float band = step(0.5, fract(vY * 12.0)); float major = step(0.82, fract(vY * 3.0));
          gl_FragColor = vec4(mix(uDark, uLight, max(band, major)), 1.0);
          #include <colorspace_fragment>
        }`,
    })
    const wells = new InstancedMesh(well, concrete, stormGauges.length)
    const huts = new InstancedMesh(hut, roof, stormGauges.length)
    const staffs = new InstancedMesh(staff, staffMat, stormGauges.length)
    const o = new Object3D()
    stormGauges.forEach((g, i) => {
      const { n, c, px, pz } = sideOf(g.id)
      const bx = n.pos[0] + px * (c.hw + 0.22)
      const bz = n.pos[2] + pz * (c.hw + 0.22)
      const gy = terrainHeight(bx, bz)
      const h = 0.72
      o.position.set(bx, gy + h / 2, bz)
      o.rotation.set(0, 0, 0)
      o.scale.set(1, h, 1)
      o.updateMatrix()
      wells.setMatrixAt(i, o.matrix)
      o.position.set(bx, gy + h + 0.085, bz)
      o.rotation.set(0, Math.atan2(px, pz), 0)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      huts.setMatrixAt(i, o.matrix)
      // Staff plate standing in the channel near the tower's bank.
      const sx = n.pos[0] + px * c.hw * 0.7
      const sz = n.pos[2] + pz * c.hw * 0.7
      const base = thalwegAt(c)
      o.position.set(sx, base + 0.21, sz)
      o.scale.set(1, 0.42, 1)
      o.updateMatrix()
      staffs.setMatrixAt(i, o.matrix)
      towerAnchor[i].set(bx, gy + h + 0.4, bz)
    })
    return { wells, huts, staffs, dispose: [well, hut, staff, concrete, roof, staffMat] }
  }, [q.radialSegments])
  useEffect(() => () => built.dispose.forEach((d) => d.dispose()), [built])
  return (
    <group>
      <primitive object={built.wells} />
      <primitive object={built.huts} />
      <primitive object={built.staffs} />
    </group>
  )
}

/** Every ungauged cross-section: a survey line across the channel at bank height, and two pins. No reading. */
function SectionLines() {
  const built = useMemo(() => {
    const gauged = new Set(stormGauges.map((g) => g.id))
    const pts: number[] = []
    const pins: [number, number, number][] = []
    for (const n of nodes) {
      if (gauged.has(n.id)) continue
      const { c, px, pz } = sideOf(n.id)
      const y = thalwegAt(c) + BANK_H + 0.015
      const r = c.hw + 0.14
      const a: [number, number, number] = [n.pos[0] - px * r, y, n.pos[2] - pz * r]
      const b: [number, number, number] = [n.pos[0] + px * r, y, n.pos[2] + pz * r]
      pts.push(...a, ...b)
      pins.push(a, b)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    const m = new LineBasicMaterial({ color: new Color(readToken('foam-soft')), transparent: true, opacity: 0.75 })
    const pinGeo = new BoxGeometry(0.025, 0.1, 0.025)
    const pinMat = new MeshLambertMaterial({ color: new Color(readToken('foam-soft')) })
    const mesh = new InstancedMesh(pinGeo, pinMat, pins.length)
    const o = new Object3D()
    pins.forEach((p, i) => {
      o.position.set(p[0], p[1] + 0.05, p[2])
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    return { g, m, mesh, dispose: [g, m, pinGeo, pinMat] }
  }, [])
  useEffect(() => () => built.dispose.forEach((d) => d.dispose()), [built])
  return (
    <group>
      <lineSegments geometry={built.g} material={built.m} />
      <primitive object={built.mesh} />
    </group>
  )
}

/* --------------------------------------------------------- gauge readouts */

/*
  Gauge boards are plain DOM, one layer for all four, positioned by projecting
  each tower top through the camera on every rendered frame. The numbers are
  the dataset's depth and discharge at that gauge, at the current hour.
*/
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
      const q = dischargeAt(id, t)
      if (f) f.textContent = q == null ? '' : `${fmt(q, 1)} m³/s`
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
          />{' '}
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

// Camera stands downstream and looks up the valley; the dolly follows the storm.
const scrollState = { p: 0 }
const T0 = new Vector3(0.0, 0.9, 0.6)
const T1 = new Vector3(5.0, 0.4, 0.4)

function CameraRig({ q }: { q: Quality }) {
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
    // board layer's style writes would force a layout of the whole page per frame.
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
    const p = MathUtils.clamp(scrollP * 0.8, 0, 1)
    const target = T0.clone().lerp(T1, p)
    if (portrait) target.set(1.2 + p * 3, 0.9, 0.3)

    const radius = portrait ? Math.min(60, 32 / Math.max(0.45, aspect)) : 40 - Math.min(aspect, 2.2) * 2
    const az = (portrait ? 1.42 : 1.02) + drag.current.az - p * 0.25
    const pol = (portrait ? 0.7 : 1.05) + drag.current.pol - p * 0.08
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
    // On wide screens shift the projection so the valley sits right of the
    // headline column instead of under it.
    const shift = aspect > 1.25 ? Math.round(size.width * Math.min(0.22, (aspect - 1.05) * 0.3)) : 0
    // and above the storm timeline along the bottom.
    const lift = aspect > 1.25 ? Math.round(size.height * 0.15) : 0
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
  Owns storm time. Advances it on the first pass, applies seeks from the
  timeline, and writes the hour's depth, velocity and rain for every
  cross-section into the shader uniforms.
*/
function StormClock({ water, rain }: { water: WaterUniforms; rain: { uRain: { value: Float32Array }; uTime: { value: number } } }) {
  const invalidate = useThree((s) => s.invalidate)
  const t = useRef(useSite.getState().heroTime)
  const lastPush = useRef(0)
  const reduced = useSite((s) => s.reducedMotion)

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
    for (let i = 0; i < N; i++) {
      const id = nodes[i].id
      water.uStage.value[i] = depthAt(id, h) * STAGE_SCALE
      water.uVel.value[i] = velocityAt(id, h)
      rain.uRain.value[i] = reduced ? 0 : rainAt(id, h)
    }
    if (!reduced) {
      water.uTime.value += Math.min(dt, 0.1)
      rain.uTime.value = water.uTime.value
    }
    if (state.clock.elapsedTime - lastPush.current > 0.08 || seek !== null) {
      lastPush.current = state.clock.elapsedTime
      if (Math.abs(st.heroTime - h) > 0.02) st.setHeroTime(h)
    }
  })
  return null
}

/* ----------------------------------------------------------------- scene */

function Scene() {
  const q = getQuality()
  const { size, viewport } = useThree()
  const valley = useMemo(() => buildValley(q), [q])
  const uniforms = useMemo(() => {
    const water: WaterUniforms = {
      uStage: { value: new Float32Array(N) },
      uVel: { value: new Float32Array(N) },
      uTime: { value: 0 },
    }
    const rain = { uRain: { value: new Float32Array(N) }, uTime: { value: 0 }, uPx: { value: 1 } }
    return { water, rain }
  }, [])
  uniforms.rain.uPx.value = (size.height * viewport.dpr) / 260
  const mats = useMemo(
    () => ({ ground: groundMaterial(), water: waterMaterial(q, uniforms.water), rain: rainMaterial(uniforms.rain) }),
    [q, uniforms],
  )
  const rainGeo = useMemo(() => buildRain(q), [q])
  useEffect(
    () => () => {
      valley.terrain.dispose()
      valley.water.dispose()
      rainGeo.dispose()
      mats.ground.dispose()
      mats.water.dispose()
      mats.rain.dispose()
    },
    [valley, rainGeo, mats],
  )
  const abyss = readToken('abyss')
  return (
    <>
      <color attach="background" args={[abyss]} />
      <hemisphereLight args={[readToken('foam-soft'), abyss, 0.9]} />
      <directionalLight position={[-8, 14, 9]} intensity={1.4} />
      <mesh geometry={valley.terrain} material={mats.ground} />
      <mesh geometry={valley.water} material={mats.water} frustumCulled={false} />
      <SectionLines />
      <Gauges q={q} />
      <points geometry={rainGeo} material={mats.rain} frustumCulled={false} renderOrder={3} />
      <BoardProjector />
      <StormClock water={uniforms.water} rain={uniforms.rain} />
      <CameraRig q={q} />
    </>
  )
}

export default function RiverScene() {
  const reduced = useSite((s) => s.reducedMotion)
  return (
    <div className="absolute inset-0">
      <SceneCanvas
        name="hero"
        className="absolute inset-0"
        // Water keeps moving while the hero is on screen; reduced motion draws on demand only.
        frameloop={reduced ? 'demand' : 'always'}
        camera={{ fov: 30, near: 0.5, far: 120, position: [-16, 10, 14] }}
        touchAction="pan-y"
        wrapperProps={{ role: 'img', 'aria-label': sceneLabel }}
        fallback={<NetworkPlan mode="wave" className="h-full w-full lg:ml-auto lg:w-3/5 lg:py-16" />}
      >
        <Scene />
      </SceneCanvas>
      {hasWebGL() && <GaugeBoards />}
    </div>
  )
}
