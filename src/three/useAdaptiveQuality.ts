/*
  Device tier from probing, decided once per page load.

                       low            medium          high
    DPR cap            1.0            1.5             2.0
    tube radial segs   6              8               12
    terrain cells      150 across     230 across      320 across
    water shader       1 ripple       flow map, foam  + 2nd ripple scale
    rain drops         1,500          4,000           8,000
    post               none           none            halo on wave only
    shadows            off            off             soft, one light
    hero camera        static + drag  scroll-coupled  scroll-coupled

  "Bloom on wave only" is realised as an additive halo shell around the wave
  tubes rather than a post-processing pass: it touches nothing but the wave and
  costs one extra draw per reach.

  Phones are capped at medium. A mid-range Android (8 cores, Adreno 6xx /
  Mali-G7x, DPR ~2.6) lands on medium; 4-core devices, low memory, or known
  weak GPUs land on low. ?tier=low|medium|high overrides for testing.
*/

export type Tier = 'low' | 'medium' | 'high'

export type Quality = {
  tier: Tier
  dpr: [number, number]
  radialSegments: number
  tubularPerUnit: number
  terrainRes: number
  halo: boolean
  shadows: boolean
  scrollCamera: boolean
  antialias: boolean
}

const TABLE: Record<Tier, Omit<Quality, 'tier'>> = {
  low: { dpr: [1, 1], radialSegments: 6, tubularPerUnit: 4, terrainRes: 150, halo: false, shadows: false, scrollCamera: false, antialias: false },
  medium: { dpr: [1, 1.5], radialSegments: 8, tubularPerUnit: 6, terrainRes: 230, halo: false, shadows: false, scrollCamera: true, antialias: true },
  high: { dpr: [1, 2], radialSegments: 12, tubularPerUnit: 8, terrainRes: 320, halo: true, shadows: true, scrollCamera: true, antialias: true },
}

const WEAK_GPU = /(mali-[2-4]\d{2}|mali-t|mali-g(31|51|52|57)|adreno \(tm\) [2-5]\d{2}|powervr|swiftshader|llvmpipe|software|intel\(r\) hd graphics [2-5]\d{2,3}|mesa offscreen)/i
const STRONG_GPU = /(apple m\d|apple gpu|nvidia|geforce|rtx|radeon rx|radeon pro|adreno \(tm\) (7[3-9]\d|8\d{2})|iris xe|arc)/i

/*
  Software rasterisers draw WebGL on the CPU, on the page's main thread's
  behalf: a 3D scene there is a stream of long tasks (PageSpeed Insights'
  machines measured 90-110 ms per hero frame). They count as no WebGL, so the
  page shows its video and SVG fallbacks.
*/
const SOFTWARE_GL = /(swiftshader|llvmpipe|softpipe|microsoft basic render|mesa offscreen|software)/i

let webglCache: boolean | null = null
let rendererCache = ''

function forcedOff(): boolean {
  if (typeof window === 'undefined') return true
  return new URLSearchParams(window.location.search).get('webgl') === '0'
}

export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache
  if (forcedOff()) return (webglCache = false)
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return (webglCache = false)
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    rendererCache = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    // ?tier= forces a scene for testing, even on a software renderer.
    const forced = new URLSearchParams(window.location.search).get('tier')
    if (SOFTWARE_GL.test(rendererCache) && !forced) return (webglCache = false)
    return (webglCache = true)
  } catch {
    return (webglCache = false)
  }
}

export function probeTier(): Tier {
  if (typeof window === 'undefined') return 'low'
  const forced = new URLSearchParams(window.location.search).get('tier')
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced
  if (!hasWebGL()) return 'low'

  const dpr = window.devicePixelRatio || 1
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const shortSide = Math.min(window.screen.width, window.screen.height)
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const phone = coarse && shortSide <= 600

  if (WEAK_GPU.test(rendererCache)) return 'low'
  if (cores <= 4 || mem <= 3) return 'low'
  if (phone) return dpr > 3 && cores < 8 ? 'low' : 'medium'
  if (STRONG_GPU.test(rendererCache) && cores >= 8) return 'high'
  if (cores >= 8 && !coarse) return 'high'
  return 'medium'
}

let qualityCache: Quality | null = null

export function getQuality(): Quality {
  if (!qualityCache) {
    const tier = probeTier()
    qualityCache = { tier, ...TABLE[tier] }
  }
  return qualityCache
}

export function useAdaptiveQuality(): Quality {
  return getQuality()
}
