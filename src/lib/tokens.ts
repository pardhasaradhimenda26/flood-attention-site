// Read colour tokens from tokens.css at runtime so WebGL and SVG draw from the
// same values as the DOM. Fallbacks only matter before the stylesheet loads.
const FALLBACK: Record<string, string> = {
  abyss: '#15303c',
  'abyss-raised': '#1d3c4a',
  'abyss-line': '#2f5262',
  paper: '#e2e9eb',
  ink: '#132530',
  'ink-soft': '#3f5964',
  foam: '#dce7ea',
  'foam-soft': '#9db6bf',
  graticule: '#9fb3ba',
  w1: '#bfdce4',
  w2: '#86b8c8',
  w3: '#4f90a8',
  w4: '#2c6a84',
  w5: '#1a4a5f',
  signal: '#c2185b',
  'signal-lift': '#ec5c9b',
}

const cache = new Map<string, string>()

export function readToken(name: keyof typeof FALLBACK | string): string {
  const hit = cache.get(name)
  if (hit) return hit
  let v = ''
  if (typeof window !== 'undefined') {
    v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  }
  const out = v || FALLBACK[name] || '#ff00ff'
  if (v) cache.set(name, out)
  return out
}

export const RAMP = ['w1', 'w2', 'w3', 'w4', 'w5'] as const
