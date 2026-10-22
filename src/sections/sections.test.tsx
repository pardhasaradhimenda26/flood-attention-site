import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { hero, verdict } from '../data/content'

// The WebGL probe answers "no", as it does on a machine without WebGL.
vi.mock('../three/useAdaptiveQuality', async (orig) => {
  const mod = await orig<typeof import('../three/useAdaptiveQuality')>()
  return { ...mod, hasWebGL: () => false }
})

describe('WebGL fallback', () => {
  it('shows the exported inundation video, with a real poster, when WebGL is unavailable', async () => {
    const { Hero } = await import('./Hero')
    render(<Hero />)
    const video = (await screen.findByLabelText(hero.fallbackLabel, {}, { timeout: 3000 })) as HTMLVideoElement
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('src')).toMatch(/wayanad\/inundation_T1\.mp4$/)
    expect(video.getAttribute('poster')).toMatch(/wayanad\/plan\.png$/)
  })
})

describe('sections mount and state their claims', () => {
  it('Verdict shows both claims, the null, and the pending real-gauge result', async () => {
    const { Verdict } = await import('./Verdict')
    const { container } = render(<Verdict />)
    expect(screen.getByText(verdict.accuracy.title)).toBeTruthy()
    expect(screen.getByText(verdict.attention.title)).toBeTruthy()
    // the attention correlations and the baseline that beats them, in one view
    for (const v of ['+0.017', '−0.129', '+0.438', '+0.386']) expect(container.textContent).toContain(v)
    expect(container.querySelectorAll('[data-status="qualified"]').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('[data-status="pending"]')).not.toBeNull()
  })

  it('Findings and Results render without errors and keep the held-out panel separate', async () => {
    const { Findings } = await import('./Findings')
    const { Results } = await import('./Results')
    render(<Findings />)
    const { container } = render(<Results />)
    expect(container.textContent).toContain('Held-out basins, on their own')
    expect(container.textContent).not.toMatch(/\{\w+\}/) // no unfilled template placeholder
  })
})

describe('every act mounts', () => {
  it('Problem, Approach, Attention, Dataset, Rigor and the footer render without errors', async () => {
    const mods = await Promise.all([
      import('./Problem'),
      import('./Approach'),
      import('./Attention'),
      import('./Dataset'),
      import('./Rigor'),
      import('./Footer'),
    ])
    const [P, A, At, D, R, F] = [mods[0].Problem, mods[1].Approach, mods[2].Attention, mods[3].Dataset, mods[4].Rigor, mods[5].Footer]
    for (const C of [P, A, At, D, R, F]) {
      const { container, unmount } = render(<C />)
      expect(container.textContent!.length).toBeGreaterThan(50)
      // Template placeholders are two letters or more; the attention equation has a genuine {i}.
      expect(container.textContent).not.toMatch(/\{[a-zA-Z]{2,}\w*\}|\[\[|NaN|undefined/)
      unmount()
    }
  })
})
