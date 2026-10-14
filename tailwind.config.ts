import type { Config } from 'tailwindcss'

const v = (name: string) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '600px',
      md: '820px',
      lg: '1100px',
      xl: '1360px',
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      abyss: { DEFAULT: v('abyss'), raised: v('abyss-raised'), line: v('abyss-line') },
      paper: { DEFAULT: v('paper'), inset: v('paper-inset'), line: v('paper-line') },
      ink: { DEFAULT: v('ink'), soft: v('ink-soft') },
      foam: { DEFAULT: v('foam'), soft: v('foam-soft') },
      graticule: v('graticule'),
      w1: v('w1'),
      w2: v('w2'),
      w3: v('w3'),
      w4: v('w4'),
      w5: v('w5'),
      signal: { DEFAULT: v('signal'), lift: v('signal-lift'), on: v('signal-on') },
      fg: { DEFAULT: v('fg'), soft: v('fg-soft') },
      rule: v('rule'),
    },
    fontFamily: {
      sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
    },
    fontSize: {
      micro: ['0.75rem', { lineHeight: '1.35' }],
      small: ['0.875rem', { lineHeight: '1.45' }],
      body: ['1.0625rem', { lineHeight: '1.62' }],
      lead: ['1.25rem', { lineHeight: '1.5' }],
      h3: ['1.375rem', { lineHeight: '1.25' }],
      h2: ['clamp(2.1rem, 2.6vw + 1.2rem, 3.6rem)', { lineHeight: '0.98' }],
      display: ['clamp(2.5rem, 2.7vw + 1.1rem, 4.4rem)', { lineHeight: '0.94' }],
      reading: ['clamp(1.9rem, 2.4vw + 1rem, 2.9rem)', { lineHeight: '1' }],
      figure: ['clamp(3rem, 6vw + 1rem, 6rem)', { lineHeight: '0.9' }],
    },
    extend: {
      maxWidth: {
        measure: '66ch',
        narrow: '52ch',
        lede: '42ch',
        'lede-wide': '36rem',
        figure: '76rem',
        caption: '28ch',
        headline: '16ch',
        panel: '24rem',
        tip: '18rem',
      },
      spacing: {
        rail: '5.5rem',
        gutter: '1rem',
        'staff-t': '3%',
        'staff-b': '5%',
      },
      boxShadow: {
        hair: '0 0 0 1px var(--abyss-line)',
        'hair-paper': '0 0 0 1px var(--paper-line)',
      },
      gridTemplateColumns: {
        lead: 'auto 1fr',
      },
      transitionProperty: {
        top: 'top',
        stroke: 'stroke, stroke-width, opacity',
      },
      letterSpacing: {
        display: '-0.02em',
        tightish: '-0.01em',
      },
      borderWidth: {
        hair: '1px',
      },
      height: {
        hero: '100svh',
        scene: 'min(72svh, 44rem)',
        sceneSm: '58svh',
        section3d: '26rem',
        attn: 'clamp(24rem, 60svh, 30rem)',
      },
      minHeight: {
        hero: '40rem',
        // a full screen, but never less than the hero's content needs
        heroFit: 'max(100svh, 40rem)',
        // the storm timeline's height, reserved so the hero does not shift when it loads
        timeline: '15.5rem',
      },
      minWidth: {
        'figure-sm': '40rem',
      },
      zIndex: {
        rail: '20',
        overlay: '10',
      },
    },
  },
  plugins: [],
} satisfies Config
