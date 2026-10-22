import { describe, expect, it } from 'vitest'
import { W, dateAt, depthAt, inflowPeakHour, lagHours, lastHour, outletId, outletPeakHour, peakOf, sections, stormGauges } from './storm'

describe('the hero flood (Wayanad HEC-RAS 2D, event T1)', () => {
  it('has the export the hero needs: sections, four gauges with series, inflow', () => {
    // The measured-travel-time spacing rule leaves 7 sections on this reach (WAYANAD_FINDINGS.md).
    expect(sections.length).toBeGreaterThanOrEqual(6)
    expect(stormGauges.length).toBe(4)
    for (const g of stormGauges) {
      expect(g.section.depth_m!.length).toBe(lastHour + 1)
      expect(g.section.discharge_m3s!.length).toBe(lastHour + 1)
    }
    expect(W.inflowM3s.length).toBe(lastHour + 1)
    expect(W.source).toMatch(/model output/)
    expect(W.source).toMatch(/not yet validated/)
  })

  it('orders the sections downstream and the gauges from the inflow to the outlet', () => {
    for (let i = 1; i < sections.length; i++) expect(sections[i].s_m).toBeGreaterThan(sections[i - 1].s_m)
    expect(stormGauges[stormGauges.length - 1].id).toBe(outletId)
  })

  it('shows a lag you can measure: each gauge peaks no earlier than the one upstream', () => {
    expect(lagHours).toBeGreaterThan(0)
    expect(outletPeakHour - inflowPeakHour).toBe(lagHours)
    const peaks = stormGauges.map((g) => peakOf(g.id).hour)
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1])
  })

  it('interpolates between hours and labels time in model dates', () => {
    const id = stormGauges[0].id
    const a = depthAt(id, 10)
    const b = depthAt(id, 11)
    expect(depthAt(id, 10.5)).toBeCloseTo((a + b) / 2, 6)
    expect(dateAt(0)).toMatch(/^\d{1,2} Aug, \d{2}:00$/)
  })
})
