import { describe, expect, it } from 'vitest'
import { hero } from '../data/content'
import {
  FLOW_SPEEDUP,
  W,
  dateAt,
  depthAt,
  gridAtChainage,
  inflowPeakHour,
  lagHours,
  lastHour,
  outletId,
  outletPeakHour,
  peakOf,
  sections,
  stormGauges,
} from './storm'

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

  it('places every section on the map: coordinates inside the grid, and a named place for each gauge', () => {
    const { nw, se } = W.corners
    for (const s of sections) {
      expect(s.lat).toBeGreaterThan(se[0])
      expect(s.lat).toBeLessThan(nw[0])
      expect(s.lon).toBeGreaterThan(nw[1])
      expect(s.lon).toBeLessThan(se[1])
    }
    for (const g of stormGauges) expect(g.place).toBeTruthy()
    expect(W.places.source).toMatch(/OpenStreetMap/)
    expect(W.velStepMs).toBeGreaterThan(0)
  })

  it('credits what is not model output, and says the water is sped up', () => {
    expect(hero.scaleNote).toContain('{speedup}')
    expect(FLOW_SPEEDUP).toBeGreaterThan(1)
    expect(hero.scaleNote).toMatch(/Sentinel-2 cloudless 2016 by EOX/)
    expect(hero.scaleNote).toMatch(/CC BY 4\.0/)
    expect(hero.scaleNote).toMatch(/OpenStreetMap contributors/)
    expect(hero.scaleNote).toMatch(/not yet validated/)
    // The model has no rainfall: the rain must be labelled as illustrative.
    expect(hero.scaleNote).toMatch(/rain is illustrative/i)
    expect(hero.scaleNote).toMatch(/has no rainfall/)
  })

  it('finds points along the river between sections, for the camera flight', () => {
    for (const sec of sections) expect(gridAtChainage(sec.s_m)).toEqual(sec.grid)
    const [a, b] = [sections[0], sections[1]]
    const mid = gridAtChainage((a.s_m + b.s_m) / 2)
    expect(mid[0]).toBeCloseTo((a.grid[0] + b.grid[0]) / 2, 6)
    expect(mid[1]).toBeCloseTo((a.grid[1] + b.grid[1]) / 2, 6)
  })
})
