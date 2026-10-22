import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3 } from 'three'
import { readToken } from '../lib/tokens'

/*
  Rain, for atmosphere only. The HEC-RAS model has no rainfall (its rain input
  is zero): all its water enters at the upstream boundary. The August 2018
  floods followed extreme monsoon rain, so the hero shows rain falling, and the
  scale note says it is illustrative.

  Every drop is animated on the GPU from a fixed random seed and the clock: a
  streak falling through a box around the ground the camera looks at, sized to
  the camera's distance so the rain reads the same in the flight and the
  overview. Nothing runs on the main thread per drop.
*/
export function Rain({ count, running }: { count: number; running: boolean }) {
  const camera = useThree((s) => s.camera)
  const built = useMemo(() => {
    const seed = new Float32Array(count * 2 * 3)
    const end = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const a = Math.random()
      const b = Math.random()
      const c = Math.random()
      for (let k = 0; k < 2; k++) {
        seed.set([a, b, c], (2 * i + k) * 3)
        end[2 * i + k] = k
      }
    }
    const geo = new BufferGeometry()
    // Positions come from the seeds in the shader; this only sizes the draw.
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 2 * 3), 3))
    geo.setAttribute('aSeed', new BufferAttribute(seed, 3))
    geo.setAttribute('aEnd', new BufferAttribute(end, 1))
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector3() },
        uSize: { value: 10 },
        uColor: { value: new Color(readToken('foam-soft')) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        attribute float aEnd;
        uniform float uTime; uniform vec3 uCenter; uniform float uSize;
        varying float vA;
        void main() {
          float h = uSize * 0.9;                 // height of the falling box
          float fall = h * (1.1 + 0.4 * aSeed.z); // a box height a second or so
          float y = fract(aSeed.y - uTime * fall / h) * h;
          // A light wind from the south-west, as in the monsoon: drops drift
          // north-east (+x, -z) as they fall.
          vec2 wind = vec2(0.18, -0.12) * h;
          vec3 p = vec3(uCenter.x + (aSeed.x - 0.5) * 2.0 * uSize - wind.x * (y / h),
                        uCenter.y + y,
                        uCenter.z + (fract(aSeed.x * 13.7 + aSeed.z * 7.3) - 0.5) * 2.0 * uSize - wind.y * (y / h));
          // The tail of the streak, up-wind and above.
          float len = h * 0.035;
          p += aEnd * vec3(-wind.x / h * len, len, -wind.y / h * len);
          vA = mix(0.32, 0.0, aEnd) * smoothstep(0.0, 0.08, y / h) * (1.0 - smoothstep(0.85, 1.0, y / h));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          gl_FragColor = vec4(uColor, vA);
          #include <colorspace_fragment>
        }`,
    })
    return { geo, mat }
  }, [count])
  useEffect(
    () => () => {
      built.geo.dispose()
      built.mat.dispose()
    },
    [built],
  )
  const fwd = useMemo(() => new Vector3(), [])

  useFrame((_, dt) => {
    if (!running) return
    const u = built.mat.uniforms
    u.uTime.value += Math.min(dt, 0.1)
    // The ground the camera looks at: where its view ray meets y = 0.
    camera.getWorldDirection(fwd)
    const t = fwd.y < -0.05 ? camera.position.y / -fwd.y : 30
    const c = u.uCenter.value as Vector3
    c.copy(camera.position).addScaledVector(fwd, t)
    c.y = 0
    u.uSize.value = Math.max(2, camera.position.distanceTo(c) * 0.55)
  })

  if (!running) return null
  return <lineSegments geometry={built.geo} material={built.mat} frustumCulled={false} renderOrder={3} />
}
