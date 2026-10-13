import { problemHydrograph as H } from '../data/network'
import { gaugeName } from './graph'

const argmax = (a: number[]) => a.indexOf(Math.max(...a))

export function hydroStats() {
  const iu = argmax(H.recordedUpstream)
  const id = argmax(H.recordedDownstream)
  const ir = argmax(H.routedUpstreamOnly)
  const base = Math.min(...H.recordedUpstream)
  const pkU = H.recordedUpstream[iu]
  const pkR = H.routedUpstreamOnly[ir]
  return {
    iu,
    id,
    ir,
    lagRecorded: id - iu,
    lagRouted: ir - iu,
    // attenuation of the flood above base flow
    pctRouted: Math.round((100 * (pkR - base)) / (pkU - base)),
    up: gaugeName.get(H.upstream.id) ?? H.upstream.label,
    down: gaugeName.get(H.downstream.id) ?? H.downstream.label,
  }
}
