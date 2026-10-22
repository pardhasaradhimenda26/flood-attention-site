import type { Status } from './results'
import { termsIn } from './glossary'
import { ciOf, metric, mv } from '../lib/metrics'
import { fmt } from '../lib/format'

/*
  Every technical claim on the page, in two layers (CLAUDE_FAS.md §4):

    plain      one sentence a reader with no background can follow
    technical  the precise, qualified statement, with its numbers
    status     the claim's evidential status; it must equal the weakest
               status among the metrics it cites (claims.test.ts enforces it)
    terms      glossary terms used, from the [[markers]] in either line

  Numbers are filled from results.ts here, never typed.
*/

export type TermRef = string

export type Claim = {
  id: string
  plain: string
  technical: string
  status: Status
  terms: TermRef[]
  /** metric ids the claim rests on */
  metrics: string[]
}

function claim(id: string, status: Status, metrics: string[], plain: string, technical: string): Claim {
  const terms = [...termsIn(plain), ...termsIn(technical)].map((t) => t.term?.id ?? `?${t.shown}`)
  return { id, plain, technical, status, terms: [...new Set(terms)], metrics }
}

const pct = (id: string) => mv(id, true)
const num = (id: string) => Number(metric(id)?.value)

export const claims = {
  // ---- Act 2: why it is hard
  unmeasured: claim(
    'unmeasured',
    'verified',
    ['real_sections', 'real_gauges', 'real_ungauged'],
    'Most of a river has no sensor, so nobody knows how high the water is there.',
    `The real network has ${mv('real_sections')} surveyed [[cross-sections|cross-section]] and ${mv('real_gauges')} [[gauges|gauge]], H1 to H4: ${pct('real_ungauged')} of sections have no record of [[discharge]] or [[stage]].`,
  ),
  lag: claim(
    'lag',
    'verified',
    ['mean_tt'],
    'A flood takes hours or days to travel down a river, and the delay is different on every stretch.',
    `Each [[reach]] has its own [[travel time|travel-time]], set by its length and the flood wave’s [[celerity]]; in the simulated basins the mean is ${mv('mean_tt', true)} per reach. [[Muskingum routing|muskingum]] describes a reach by K, its travel time, and X, how much water it stores ahead of the wave.`,
  ),

  // ---- Act 3: the idea
  graph: claim(
    'graph',
    'verified',
    ['nodes', 'edges'],
    'Each place on the river becomes a point, and each stretch of channel becomes a link between two points.',
    `Each surveyed [[cross-section]] is a [[node]] and each reach an [[edge]] pointing downstream: ${mv('nodes')} nodes and ${mv('edges')} edges across eight [[basins|basin]], including message-only shortcuts two or three [[hops|hop]] long.`,
  ),
  passing: claim(
    'passing',
    'verified',
    ['gauged_pct'],
    'Places without a sensor are filled in from the places upstream of them.',
    `Three [[message-passing]] layers over edges of up to three hops reach nine reaches upstream. [[Gauged|gauge]] nodes (${pct('gauged_pct')}) receive observed discharge and depth; [[ungauged]] nodes receive zeros and a mask.`,
  ),
  physics: claim(
    'physics',
    'verified',
    [],
    'The model is penalised whenever its forecast creates or loses water.',
    'The loss adds a [[continuity]] residual at every node — inflow from upstream reaches, plus local inflow, minus outflow, minus the change in storage — weighted at 0.05. Travel time appears nowhere in the loss or the inputs.',
  ),
  attending: claim(
    'attending',
    'verified',
    [],
    'Instead of treating every upstream place equally, the model learns how much to listen to each one.',
    'A [[GAT|gat]] (GATv2) replaces the [[GCN|gcn]]’s fixed, degree-normalised average with a learned [[attention]] weight on each incoming edge, recomputed at every hour of the [[rollout]]. Everything else is held identical.',
  ),
  junction: claim(
    'junction',
    'qualified',
    ['att_tt_r', 'att_local_area'],
    'At a junction the model listens more to the bigger branch, but not to the branch whose water arrives first.',
    `Learned weights at the [[confluence]] follow upstream area (r ${mv('att_local_area')}), not travel time (hop-stratified r ${mv('att_tt_r')}, ${ciOf('att_tt_r')}).`,
  ),
  checkable: claim(
    'checkable',
    'verified',
    ['basins', 'mass_balance'],
    'The test river is simulated, so the right answer is known everywhere and the model can be checked against it.',
    `${mv('basins')} [[synthetic]] basins with known K, X and celerity on every reach; [[mass balance|mass-balance]] closes at ${mv('mass_balance')} in every basin.`,
  ),

  // ---- Act 4: what held, and what did not
  accuracy: claim(
    'accuracy',
    'qualified',
    ['gat_vs_gcn'],
    'Learned attention made the forecasts somewhat more accurate, by an amount that is real but uncertain.',
    `GAT over GCN, ungauged discharge [[RMSE|rmse]]: ${pct('gat_vs_gcn')}, [[95% interval|interval]] from a [[bootstrap]] over basins and [[seeds|seed]]: ${ciOf('gat_vs_gcn').replace('95% interval ', '')}. Pooled over 8 basins, 3 seeds.`,
  ),
  heldOut: claim(
    'heldOut',
    'qualified',
    ['gat_vs_gcn_held'],
    'On rivers the model had never seen, the improvement could not be confirmed.',
    `[[Held-out|held-out]] basins only: ${pct('gat_vs_gcn_held')}, ${ciOf('gat_vs_gcn_held')} — the interval includes zero.`,
  ),
  physicsNull: claim(
    'physicsNull',
    'qualified',
    ['att_tt_r', 'att_tt_r_routing', 'att_confound', 'att_vs_confound', 'att_seed_r'],
    'We checked whether the model learned real river physics, and it did not: a far simpler rule predicted the timings better.',
    `Hop-stratified [[correlation]] of attention with travel time: ${mv('att_tt_r')} (${ciOf('att_tt_r')}); ${mv('att_tt_r_routing')} on routing edges. Reach length alone, the [[confound]], scores ${mv('att_confound')}; attention minus it is ${mv('att_vs_confound')} (${ciOf('att_vs_confound')}). Seeds agree at ${mv('att_seed_r')}.`,
  ),
  realPending: claim(
    'realPending',
    'pending',
    ['real_gat_vs_gcn'],
    'Nobody has tested this on the real river’s sensors yet.',
    'GAT vs GCN on the H1–H4 gauge record: pending. Every number on this page comes from synthetic basins or from HEC-RAS model output, not from gauges.',
  ),
  week4: claim(
    'week4',
    'qualified',
    ['w4_own_r2', 'w4_gain_6h', 'w4_gain_12h', 'w4_gcn_win'],
    'At first the river connections added nothing, because each sensor’s own history already told the model what would happen next.',
    `With its own history, a node’s discharge one hour ahead had [[R²|r-squared]] ${mv('w4_own_r2')}; adding upstream history changed mean R² by ${mv('w4_gain_6h')} at 6 h and ${mv('w4_gain_12h')} at 12 h. The GCN beat the [[MLP|mlp]] in one basin of three (${pct('w4_gcn_win')}, ${ciOf('w4_gcn_win')}).`,
  ),
  gate: claim(
    'gate',
    'qualified',
    ['gate_all', 'gate_served'],
    'Once sensors were taken away from most places, the upstream information became genuinely useful.',
    `Gate test, ΔR² at ungauged nodes: ${mv('gate_all')} overall (below the pass mark in one basin of eight), ${mv('gate_served')} where a gauged node is within reach upstream; pass mark 0.05, so ${fmt(num('gate_served') / 0.05, 1)} times over.`,
  ),
  trap: claim(
    'trap',
    'verified',
    ['trap_untrained', 'trap_confound'],
    'The first way of scoring the model’s attention gave a near-perfect result even for a model that had learned nothing.',
    `Plain within-node r on an untrained GATv2: ${mv('trap_untrained')}, because hop count drives both reach length and travel time (r ${mv('trap_confound')}). Replaced by a hop-stratified r scored against a [[permutation null|permutation-null]].`,
  ),
  learned: claim(
    'learned',
    'qualified',
    ['att_local_area', 'att_mean_q', 'att_tt_r'],
    'The model learned to listen to the branch carrying more water, not to the branch whose water arrives sooner.',
    `Attention vs upstream local area ${mv('att_local_area')} and upstream mean discharge ${mv('att_mean_q')}, same sign in all 8 basins; vs travel time ${mv('att_tt_r')}.`,
  ),
  // ---- Wayanad: a real river, modelled (first numbers; qualified at best)
  wyPort: claim(
    'wyPort',
    'qualified',
    ['wy_reach_km', 'wy_sections', 'wy_cells_located'],
    'The project now also runs on a computer model of a real river in flood, not only on made-up ones.',
    `[[HEC-RAS|hec-ras]] 2D [[model output|model-output]] for the Kabini reach in Wayanad, 15 floods built from the August 2018 inflow. The 2D mesh was reduced to ${mv('wy_sections')} [[cross-sections|cross-section]] along a ${mv('wy_reach_km', true)} centreline; ${mv('wy_cells_located', true)} of mesh cells were located from the supplied rasters because the coordinate files were missing.`,
  ),
  wyLag: claim(
    'wyLag',
    'qualified',
    ['wy_travel_h', 'wy_celerity', 'wy_tt_length_r'],
    'Here a flood takes about half a day to cross the modelled stretch, and that delay was measured from the model, not assumed.',
    `[[Travel time|travel-time]] over the reach ${mv('wy_travel_h', true)}, from cross-correlation and peak arrival, which disagree by up to an hour in a floodplain storage zone. [[Celerity]] ${mv('wy_celerity', true)} per reach; travel time vs reach length r = ${mv('wy_tt_length_r')}.`,
  ),
  wyAccuracy: claim(
    'wyAccuracy',
    'qualified',
    ['wy_gat_vs_gcn', 'wy_gat_vs_mlp'],
    'Learned attention may help on this river too, but five test floods are too few to be sure.',
    `GAT over GCN at [[ungauged]] sections, held-out floods: ${pct('wy_gat_vs_gcn')}, ${ciOf('wy_gat_vs_gcn')}. Both graph models beat the graph-blind [[MLP|mlp]] by ${pct('wy_gat_vs_mlp')}: without upstream information an ungauged section is not predictable at all.`,
  ),
  wyAttention: claim(
    'wyAttention',
    'qualified',
    ['wy_att_tt_r', 'wy_att_confound', 'wy_att_seed_r'],
    'Again the model’s attention did not follow how long water takes to arrive, and the length of each stretch predicts that far better.',
    `Stratified [[correlation]] of attention with measured travel time: ${mv('wy_att_tt_r')}, inside the [[permutation null|permutation-null]]. Reach length alone, the [[confound]], scores ${mv('wy_att_confound')}. Seeds agree at ${mv('wy_att_seed_r')}.`,
  ),
  wyValidation: claim(
    'wyValidation',
    'pending',
    ['wy_validation'],
    'Nobody has yet checked this river model against real measurements.',
    'HEC-RAS output vs observed gauge records or satellite flood extent: pending. Every Wayanad number here is model output, not yet validated against observations.',
  ),
  undirected: claim(
    'undirected',
    'qualified',
    ['undirected_gain'],
    'Letting information flow upstream as well as down looked like a big gain, but it did not survive a careful check.',
    `[[Ablation]], undirected graph vs the directed reference: ${pct('undirected_gain')}, ${ciOf('undirected_gain')}; better in only some basin–seed pairs, mechanism unexplained.`,
  ),
} satisfies Record<string, Claim>

export type ClaimId = keyof typeof claims
