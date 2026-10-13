import { confluences, mainArrival, mainStem } from './graph'

/*
  The page is the main stem's long profile. Each section sits at a real
  cross-section of the basin, at that node's elevation and at the time the
  main-stem flood peak reaches it. Reading the page is travelling downstream.
*/

export type SectionKey =
  | 'top'
  | 'problem'
  | 'approach'
  | 'attention'
  | 'dataset'
  | 'findings'
  | 'results'
  | 'rigor'
  | 'footer'

const ORDER: [SectionKey, string, number][] = [
  ['top', 'Headwater', 0],
  ['problem', 'Problem', 0.12],
  ['approach', 'Approach', 0.24],
  ['attention', 'Attention', 0.35],
  ['dataset', 'Dataset', 0.53],
  ['findings', 'Findings', 0.7],
  ['results', 'Results', 0.82],
  ['rigor', 'Rigor', 0.94],
  ['footer', 'Outlet', 1],
]

export type Station = {
  key: SectionKey
  title: string
  nodeId: string
  nodeLabel: string
  elevationM: number
  hours: number
  note: string | null
}

const confIds = new Set(confluences.map((c) => c.id))

export const stations: Station[] = ORDER.map(([key, title, f]) => {
  const n = mainStem[Math.round(f * (mainStem.length - 1))]
  const note = n.gauged
    ? `${n.gaugeRole?.replace('_', '-')} gauge`
    : confIds.has(n.id)
      ? 'confluence'
      : null
  return {
    key,
    title,
    nodeId: n.id,
    nodeLabel: n.label,
    elevationM: n.elevationM,
    hours: mainArrival(n.id),
    note,
  }
})

export const stationOf = (key: SectionKey) => stations.find((s) => s.key === key)!

export const profile = mainStem.map((n) => ({ label: n.label, elevationM: n.elevationM, hours: mainArrival(n.id) }))
export const profileTop = Math.max(...profile.map((p) => p.elevationM))
export const profileBottom = Math.min(...profile.map((p) => p.elevationM))
