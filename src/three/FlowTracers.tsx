import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, ShaderMaterial, Vector2 } from 'three'
import { readToken } from '../lib/tokens'

/*
  The current, made visible: foam streaks carried by the model's velocity.

  Each tracer reads depth and velocity from the water mesh at its position
  (bilinear between the four surrounding grid vertices, which FloodClock
  updates from the HEC-RAS frames), moves with that velocity sped up by the
  same factor as the water's ripples, and is drawn as a short streak along its
  path: a ribbon of constant screen width (WebGL lines are one device pixel),
  tapering to its tail. Tracers are born on water at least 30 cm deep, more often where it runs
  fast, and fade out after a few seconds or when the water under them dries.
  So they crowd and race in the channel and drift slowly over the floodplain,
  as the model says the water does.
*/

export type Grid = {
  /** The water mesh: position (ground), aDepth (m) and aVel (east, north, m/s) per vertex. */
  water: BufferGeometry
  /** Strided grid vertex to water vertex, or −1. */
  waterOf: Int32Array
  vx: number
  vy: number
  /** km per strided grid step, and the grid's half extents in km. */
  stepKm: number
  halfX: number
  halfZ: number
  /** Vertical exaggeration, world units per metre. */
  vexPerM: number
  /** Real m/s to world units per second. */
  advect: number
}

export function FlowTracers({ grid, count, running }: { grid: Grid; count: number; running: boolean }) {
  const state = useMemo(
    () => ({
      x: new Float32Array(count),
      z: new Float32Array(count),
      age: new Float32Array(count),
      life: new Float32Array(count).fill(-1),
    }),
    [count],
  )
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const built = useMemo(() => {
    // Four vertices per tracer: head left/right, tail left/right. Each carries
    // its own end (position) and the other end (aOther), so the shader can
    // extrude across the streak's direction on screen.
    const geo = new BufferGeometry()
    const pos = new BufferAttribute(new Float32Array(count * 12), 3)
    pos.setUsage(DynamicDrawUsage)
    const other = new BufferAttribute(new Float32Array(count * 12), 3)
    other.setUsage(DynamicDrawUsage)
    const alpha = new BufferAttribute(new Float32Array(count * 4), 1)
    alpha.setUsage(DynamicDrawUsage)
    const side = new Float32Array(count * 4)
    const end = new Float32Array(count * 4)
    const index = new Uint32Array(count * 6)
    for (let i = 0; i < count; i++) {
      side.set([-1, 1, -1, 1], 4 * i)
      end.set([0, 0, 1, 1], 4 * i)
      const v = 4 * i
      index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], 6 * i)
    }
    geo.setAttribute('position', pos)
    geo.setAttribute('aOther', other)
    geo.setAttribute('aAlpha', alpha)
    geo.setAttribute('aSide', new BufferAttribute(side, 1))
    geo.setAttribute('aEnd', new BufferAttribute(end, 1))
    geo.setIndex(new BufferAttribute(index, 1))
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      // Tracers lie on the water, the lowest ground in view, and the water
      // surface is drawn with a polygon offset that would hide them: they skip
      // the depth test.
      depthTest: false,
      uniforms: { uColor: { value: new Color(readToken('foam')) }, uRes: { value: new Vector2(1, 1) }, uWidth: { value: 2 } },
      vertexShader: /* glsl */ `
        attribute vec3 aOther;
        attribute float aAlpha; attribute float aSide; attribute float aEnd;
        uniform vec2 uRes; uniform float uWidth;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 c0 = projectionMatrix * viewMatrix * vec4(position, 1.0);
          vec4 c1 = projectionMatrix * viewMatrix * vec4(aOther, 1.0);
          vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * uRes;
          vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
          vec2 n = vec2(-dir.y, dir.x);
          // Full width at the head, a third of it at the tail.
          float w = uWidth * mix(1.0, 0.35, aEnd);
          c0.xy += n * aSide * w / uRes * c0.w;
          gl_Position = c0;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor * vAlpha, vAlpha);
          #include <colorspace_fragment>
        }`,
    })
    return { geo, mat, pos, other, alpha }
  }, [count])
  useEffect(() => {
    built.mat.uniforms.uRes.value.set(size.width * dpr, size.height * dpr)
    built.mat.uniforms.uWidth.value = 2 * dpr
  }, [built, size, dpr])
  useEffect(
    () => () => {
      built.geo.dispose()
      built.mat.dispose()
    },
    [built],
  )
  const sample = useRef({ d: 0, ve: 0, vn: 0, y: 0 })

  useFrame((_, rawDt) => {
    if (!running) return
    const dt = Math.min(rawDt, 0.05)
    const { water, waterOf, vx, vy, stepKm, halfX, halfZ, vexPerM, advect } = grid
    const wpos = water.getAttribute('position').array as Float32Array
    const wdep = water.getAttribute('aDepth').array as Float32Array
    const wvel = water.getAttribute('aVel').array as Float32Array
    const nWater = wdep.length
    const s = sample.current

    // Depth, velocity and surface height at a world point, bilinear over the
    // grid vertices that are water; d stays 0 on dry ground.
    const at = (x: number, z: number) => {
      const gc = (x + halfX) / stepKm
      const gr = (z + halfZ) / stepKm
      const c0 = Math.floor(gc)
      const r0 = Math.floor(gr)
      s.d = 0
      s.ve = 0
      s.vn = 0
      s.y = 0
      if (c0 < 0 || r0 < 0 || c0 >= vx - 1 || r0 >= vy - 1) return
      const fc = gc - c0
      const fr = gr - r0
      let wsum = 0
      for (let k = 0; k < 4; k++) {
        const dc = k & 1
        const dr = k >> 1
        const j = waterOf[(r0 + dr) * vx + c0 + dc]
        if (j < 0) continue
        const w = (dc ? fc : 1 - fc) * (dr ? fr : 1 - fr)
        wsum += w
        s.d += wdep[j] * w
        s.ve += wvel[2 * j] * w
        s.vn += wvel[2 * j + 1] * w
        s.y += (wpos[3 * j + 1] + wdep[j] * vexPerM) * w
      }
      if (wsum > 0) {
        s.d /= wsum
        s.ve /= wsum
        s.vn /= wsum
        s.y /= wsum
      }
      if (wsum < 0.5) s.d = 0
    }

    const spawn = (i: number) => {
      // Born on water at least 30 cm deep, preferring faster water.
      for (let tries = 0; tries < 24; tries++) {
        const j = (Math.random() * nWater) | 0
        if (wdep[j] < 0.3) continue
        const speed = Math.hypot(wvel[2 * j], wvel[2 * j + 1])
        if (Math.random() > 0.15 + speed) continue
        state.x[i] = wpos[3 * j] + (Math.random() - 0.5) * stepKm
        state.z[i] = wpos[3 * j + 2] + (Math.random() - 0.5) * stepKm
        state.age[i] = 0
        state.life[i] = 2.5 + Math.random() * 3.5
        return true
      }
      state.life[i] = -1
      return false
    }

    const P = built.pos.array as Float32Array
    const O = built.other.array as Float32Array
    const A = built.alpha.array as Float32Array
    const hide = (i: number) => A.fill(0, 4 * i, 4 * i + 4)
    for (let i = 0; i < count; i++) {
      if (state.life[i] < 0 || state.age[i] > state.life[i]) {
        if (!spawn(i)) {
          hide(i)
          continue
        }
      }
      at(state.x[i], state.z[i])
      if (s.d < 0.05) {
        state.life[i] = -1
        hide(i)
        continue
      }
      // The dataset's (east, north); the world's north is −z.
      const ux = s.ve * advect
      const uz = -s.vn * advect
      state.x[i] += ux * dt
      state.z[i] += uz * dt
      state.age[i] += dt
      const sp = Math.hypot(s.ve, s.vn)
      const fade = Math.min(1, state.age[i] / 0.5, (state.life[i] - state.age[i]) / 0.8)
      const a = Math.max(0, fade) * (0.25 + 0.55 * Math.min(1, sp / 1.5)) * Math.min(1, s.d / 0.6)
      // A streak 0.6 s of motion long, behind the tracer.
      const y = s.y + 0.004
      const hx = state.x[i]
      const hz = state.z[i]
      const tx = hx - ux * 0.6
      const tz = hz - uz * 0.6
      for (let k = 0; k < 4; k++) {
        const v = 3 * (4 * i + k)
        const tail = k >= 2
        P[v] = tail ? tx : hx
        P[v + 1] = y
        P[v + 2] = tail ? tz : hz
        O[v] = tail ? hx : tx
        O[v + 1] = y
        O[v + 2] = tail ? hz : tz
        A[4 * i + k] = tail ? 0 : a
      }
    }
    built.pos.needsUpdate = true
    built.other.needsUpdate = true
    built.alpha.needsUpdate = true
  })

  return <mesh geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={2} />
}
