import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { StatusFigure, StatusLine } from './StatusFigure'
import { metrics } from '../data/results'
import { statusSentence } from '../lib/status'

const firstWith = (status: string) => metrics.find((m) => m.status === status)!.id

/* The status must survive greyscale and a screen reader: rule style and words, never colour alone. */
describe('StatusFigure', () => {
  it('renders verified with a solid rule and the word', () => {
    const { container, getByText } = render(<StatusFigure id={firstWith('verified')} />)
    expect(container.querySelector('[data-status="verified"]')).not.toBeNull()
    expect(getByText('Verified')).toBeTruthy()
    expect(container.querySelector('.border-solid')).not.toBeNull()
    expect(container.querySelector('.border-dashed')).toBeNull()
  })

  it('renders qualified with a dashed rule and the qualifier in the same unit', () => {
    const { container, getByText } = render(<StatusFigure id="gat_vs_gcn" />)
    const unit = container.querySelector('[data-status="qualified"]')!
    expect(unit).not.toBeNull()
    expect(container.querySelector('.border-dashed')).not.toBeNull()
    expect(getByText('Qualified')).toBeTruthy()
    expect(unit.textContent).toContain('7.79')
    expect(unit.textContent).toContain('95% interval')
    expect(unit.textContent).toContain('held-out')
  })

  it('renders pending as a hatched field with the word and no rule', () => {
    const { container, getAllByText } = render(<StatusFigure id="real_gat_vs_gcn" />)
    expect(container.querySelector('.pending-hatch')).not.toBeNull()
    expect(getAllByText(/pending/i).length).toBeGreaterThan(0)
    expect(container.querySelector('.border-solid, .border-dashed')).toBeNull()
  })

  it('treats an unknown id as pending rather than inventing a value', () => {
    const { container } = render(<StatusFigure id="no_such_metric" />)
    expect(container.querySelector('[data-status="pending"]')).not.toBeNull()
  })

  it('says the status in words on a single line too', () => {
    const { container } = render(<StatusLine id="att_tt_r" />)
    expect(container.textContent).toMatch(/qualified: chance level/)
  })

  it('has a spoken form for every status', () => {
    for (const m of metrics) expect(statusSentence(m)).toMatch(/^(Verified|Qualified|Pending)/)
  })
})
