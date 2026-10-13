import { AdditiveBlending, Color, ShaderMaterial, Vector4, type IUniform } from 'three'
import { SIGMA0_H, type EdgeWave } from '../../lib/graph'

/*
  Travelling pulse shader.

  Each headwater releases a Gaussian pulse of width SIGMA0_H hours. Along a
  reach of travel time T (hours, from network.ts) the pulse centre is at

      tau(u) = arrival_at_source + u * T            u ∈ [0, 1] along the reach

  and its variance grows by the reach's measured dispersion D (h², from the
  dataset's own Muskingum routing):

      s²(u)  = variance_at_source + u * D

  Intensity is mass-conserving: amplitude scales with sigma0 / s(u), so the
  pulse gets dimmer exactly as it gets broader. Up to four headwater pulses
  superpose on a reach (routing is linear). Nothing here is a uniform delay:
  every number comes from the edge it is drawn on.
*/

export type SharedWaveUniforms = {
  uTime: IUniform<number>
  uEnvelope: IUniform<number>
}

export function createSharedWaveUniforms(t0: number): SharedWaveUniforms {
  return { uTime: { value: t0 }, uEnvelope: { value: 0 } }
}

const vertex = /* glsl */ `
  attribute float aU;
  varying float vU;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  void main() {
    vU = aU;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uEnvelope;
  uniform float uT;
  uniform float uD;
  uniform vec4 uArr;
  uniform vec4 uVar;
  uniform vec4 uAmp;
  uniform float uSigma0;
  uniform vec3 uBase;
  uniform vec3 uCrest;
  uniform float uHalo;
  varying float vU;
  varying vec3 vNormalV;
  varying vec3 vViewV;

  float pulse(float arr, float var0, float amp) {
    float s2 = var0 + vU * uD;
    float d = uTime - (arr + vU * uT);
    return amp * uSigma0 * inversesqrt(s2) * exp(-d * d / (2.0 * s2));
  }
  float peak(float var0, float amp) {
    return amp * uSigma0 * inversesqrt(var0 + vU * uD);
  }

  void main() {
    float I = pulse(uArr.x, uVar.x, uAmp.x) + pulse(uArr.y, uVar.y, uAmp.y)
            + pulse(uArr.z, uVar.z, uAmp.z) + pulse(uArr.w, uVar.w, uAmp.w);
    float E = max(max(peak(uVar.x, uAmp.x), peak(uVar.y, uAmp.y)),
                  max(peak(uVar.z, uAmp.z), peak(uVar.w, uAmp.w)));
    // Perceptual mapping only; timing and relative attenuation are untouched.
    float b = pow(clamp(I, 0.0, 1.3), 0.72);
    float e = pow(clamp(E, 0.0, 1.0), 0.72) * uEnvelope;
    float facing = abs(dot(normalize(vNormalV), normalize(vViewV)));
    if (uHalo > 0.5) {
      float a = b * pow(facing, 1.6) * 0.55;
      gl_FragColor = vec4(uCrest * a, a);
    } else {
      vec3 shade = uBase * (0.62 + 0.38 * facing) + uBase * 0.35 * pow(1.0 - facing, 3.0);
      vec3 col = mix(shade, uCrest, clamp(max(b, e * 0.32), 0.0, 1.0));
      col += uCrest * b * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }
    #include <colorspace_fragment>
  }
`

export function createWaveMaterial(
  shared: SharedWaveUniforms,
  wave: EdgeWave,
  base: string,
  crest: string,
  halo = false,
): ShaderMaterial {
  const arr = new Vector4(0, 0, 0, 0)
  const vr = new Vector4(1, 1, 1, 1)
  const amp = new Vector4(0, 0, 0, 0)
  wave.pulses.forEach((p, i) => {
    arr.setComponent(i, p.arrival)
    vr.setComponent(i, p.variance)
    amp.setComponent(i, p.amp)
  })
  const m = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: shared.uTime,
      uEnvelope: shared.uEnvelope,
      uT: { value: wave.edge.travelTimeHours },
      uD: { value: wave.dVar },
      uArr: { value: arr },
      uVar: { value: vr },
      uAmp: { value: amp },
      uSigma0: { value: SIGMA0_H },
      uBase: { value: new Color(base) },
      uCrest: { value: new Color(crest) },
      uHalo: { value: halo ? 1 : 0 },
    },
  })
  if (halo) {
    m.transparent = true
    m.depthWrite = false
    m.blending = AdditiveBlending
  }
  return m
}
