import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Rich } from './Rich'
import { ClaimBlock } from './ClaimBlock'
import { RiverToGraph } from './RiverToGraph'
import { StormTimeline } from './StormTimeline'
import { claims } from '../data/claims'
import { glossaryById } from '../data/glossary'
import { useSite } from '../state'
import { hero } from '../data/content'

describe('inline glossary', () => {
  it('turns a marked term into a keyboard-reachable control that announces its definition', () => {
    render(<Rich text="Each [[cross-sections|cross-section]] is a node." />)
    const btn = screen.getByRole('button', { name: 'cross-sections' })
    const tip = document.getElementById(btn.getAttribute('aria-describedby')!)!
    expect(tip.textContent).toContain(glossaryById.get('cross-section')!.plain)
    expect(tip.className).toContain('hidden')
    act(() => btn.focus())
    expect(tip.className).toContain('block')
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(tip.className).toContain('hidden')
  })

  it('fills placeholders before linking terms', () => {
    const { container } = render(<Rich text="{n} [[gauges|gauge]]" vars={{ n: 4 }} />)
    expect(container.textContent).toBe('4 gauges' + glossaryById.get('gauge')!.term + '. ' + glossaryById.get('gauge')!.plain)
  })
})

describe('ClaimBlock', () => {
  it('shows the plain line above the technical line, both visible, with the status in words', () => {
    const { container } = render(<ClaimBlock claim={claims.physicsNull} />)
    const ps = container.querySelectorAll('p')
    expect(ps[0].textContent).toContain('did not')
    expect(ps[1].textContent).toMatch(/^Qualified\./)
    expect(ps[1].className).toContain('border-dashed')
    expect(container.querySelector('[data-status="qualified"]')).not.toBeNull()
  })

  it('hatches a pending claim', () => {
    const { container } = render(<ClaimBlock claim={claims.realPending} />)
    expect(container.querySelector('.pending-hatch')).not.toBeNull()
    expect(container.textContent).toMatch(/Pending\./)
  })
})

describe('river-to-graph morph', () => {
  it('draws the river with a replay control', () => {
    render(<RiverToGraph />)
    expect(screen.getByRole('button', { name: /play it again/i })).toBeTruthy()
    expect(screen.getByRole('img')).toBeTruthy()
  })

  it('shows a static before and after under reduced motion', () => {
    act(() => useSite.setState({ reducedMotion: true }))
    render(<RiverToGraph />)
    expect(screen.getAllByRole('img').length).toBe(2)
    act(() => useSite.setState({ reducedMotion: false }))
  })
})

describe('storm timeline', () => {
  it('is operable by keyboard and announces what changed', () => {
    render(<StormTimeline />)
    const slider = screen.getByRole('slider', { name: hero.timelineLabel })
    fireEvent.change(slider, { target: { value: '60' } })
    expect(useSite.getState().heroSeekTo).toBe(60)
    act(() => useSite.getState().setHeroTime(60))
    const live = document.querySelector('[aria-live="polite"]')!
    expect(live.textContent).toMatch(/Hour 60/)
    expect(slider.getAttribute('aria-valuetext')).toMatch(/outlet/)
  })
})
