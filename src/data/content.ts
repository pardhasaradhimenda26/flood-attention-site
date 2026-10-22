/*
  All prose on the site. Plain verbs, sentence case, no filler.
  Numbers that come from the thesis repo are NOT written here — they are read
  from results.ts / network.ts by the components, or interpolated with {name}
  placeholders, so the copy cannot drift from what was measured.
*/

export const site = {
  title: 'Flood wave attention',
  thesisTitle:
    'Temporal Graph Attention Networks for Physics-Consistent Flood Wave Propagation Across River Cross-Section Networks',
  author: 'Pardhasaradhi Menda',
  authorShort: 'Pardhu',
  degree: 'B.Tech Computer Science and Engineering (AI/ML)',
  institution: 'SRM Institute of Science and Technology',
  github: 'https://github.com/pardhasaradhimenda26',
  githubHandle: 'pardhasaradhimenda26',
  repo: 'https://github.com/pardhasaradhimenda26/flood-attention-site',
  url: 'https://flood-attention-site.vercel.app/',
}

export const hero = {
  headline: 'The flood comes down the valley. Only four places can see it.',
  question: 'What is the water doing where nobody is measuring?',
  lede:
    'This is the Kabini river in Wayanad, Kerala, in the August 2018 floods, as a computer model of the river recreates it. Four places along it have a sensor that records how high the water is. Everywhere else, nobody knows. This project teaches a computer to estimate the water at those other places, from the four sensors and from what is coming down from upstream.',
  sceneLabel:
    'The Kabini valley in Wayanad seen from the south-east, as the HEC-RAS model recreates the August 2018 flood. Water enters at the upstream end and spreads over the low ground as it moves down the valley; the peak reaches the far end about {lag} hours after the inflow peaks. The modelled reach is {km} km long. {gauges} gauge towers show the depth they measure; the other {ungauged} marked places across the river have no reading. Height is exaggerated so the valley can be seen.',
  fallbackLabel:
    'Animation of the modelled flood spreading across the Kabini valley in Wayanad during August 2018, seen from above, coloured by water depth.',
  timelineLabel: 'Flood time',
  scaleNote:
    'Height is exaggerated 30 times, for the ground and the water alike, so depth stays in proportion to the valley. Ground outside the modelled area is a neutral fill, not data. Every depth and flow here is HEC-RAS 2D model output for the observed 2018 inflow (event T1), not yet validated against observations.',
  replay: 'Replay the flood',
  frozen: 'Reduced motion: held at the hour the gauges are deepest.',
  tableToggle: 'Read the flood as a table',
  tableCaption: 'The modelled flood at the four gauges: how deep the water got and when.',
}

export const wayanadCopy = {
  heading: 'A real river, modelled: first numbers',
  intro:
    'The flood at the top of the page and the place that turned into a graph are a HEC-RAS 2D model of the Kabini river in Wayanad, supplied by the Taiwan Project Team. This is the first experiment on it: the same four models, unchanged, trained on ten modelled floods and tested on five others. These are first numbers from a new dataset, not validated findings, and the river model itself has not yet been checked against real measurements. The synthetic-basin results that follow are the earlier work.',
  dated:
    'Run of {date}: {run}, config {hash}. Data: {archive}, sha256 {sha}…; training floods {train}, held-out floods {test}; the hero shows {hero}. HEC-RAS 2D model output, not yet validated against observations.',
  findingsLink: 'Every adaptation and assumption is logged in WAYANAD_FINDINGS.md.',
  travelCaption: 'Time for the flood peak to cross the modelled reach, measured two ways from the model output.',
  accuracyCaption: 'Lower error than the GCN at the three ungauged sections, pooled over the five held-out floods.',
  attCaption: 'Attention vs measured travel time, stratified so hop count cannot answer.',
  confoundCaption: 'Reach length alone, the same statistic. It wins.',
  seedCaption: 'How closely three training seeds agree on their attention.',
  rolloutHeading: 'Error by forecast hour, held-out floods',
  rolloutIntro:
    'The forecast horizon is {steps} hours, set from the measured travel times (about twice the mean time to cross one reach) rather than the 12 hours used on the synthetic basins. Hatched bands are 95% intervals from resampling floods and seeds; GCN’s band has a dashed edge.',
  rolloutScope: 'mean over the five held-out floods',
}

export const verdict = {
  heading: 'What held on the synthetic basins, and what did not',
  intro:
    'Before Wayanad, the project tested two claims on eight synthetic basins. Attention improved accuracy over a GCN, by a margin that is real but uncertain. Attention did not learn travel time, which was the thesis’s main contribution. Results on the real gauges are pending.',
  accuracy: {
    title: 'Accuracy: a qualified gain',
    caption:
      'Lower ungauged discharge error than the GCN, pooled over all eight synthetic basins. The interval resamples basins and seeds, because basin–seed pairs that share either are not independent.',
    heldTitle: 'Held-out basins, reported separately',
    heldCaption: 'The two basins never seen in training, on their own. Two basins and three seeds are too few to establish transfer.',
  },
  attention: {
    title: 'Interpretability: did not hold',
    captions: {
      att_tt_r: 'Trained attention vs travel time, all message edges.',
      att_tt_r_routing: 'The same on one-hop routing edges. Wrong sign.',
      att_confound: 'What reach length alone scores. A trivial input does better than the learned attention.',
      att_seed_r: 'How closely three seeds agree on their attention. The patterns are not stable.',
    } as Record<string, string>,
    chartCaption:
      'All four on one correlation axis, each with its 95% interval. Squares are point estimates; dashed intervals are qualified, solid verified. The reach-length baseline sits to the right of both attention correlations.',
    gap: 'Attention minus the reach-length baseline',
  },
}

/** The interpretability result in one view, in this order (Verdict section). */
export const VERDICT_ROWS = [
  { id: 'att_tt_r', label: 'Attention vs travel time, all message edges' },
  { id: 'att_tt_r_routing', label: 'Attention vs travel time, routing edges' },
  { id: 'att_confound', label: 'Reach length alone, the confound baseline' },
  { id: 'att_seed_r', label: 'Attention agreement between seeds' },
]

export const problem = {
  heading: 'Most of a river is never measured',
  paragraphs: [
    'The real network this thesis targets has {sections} surveyed [[cross-sections|cross-section]] and {gauges} [[gauges|gauge]], H1 to H4. At {unmeasured} of the {sections} sections — {pct}% — there is no record of [[discharge]] or [[stage]] at all. A forecast there has to come from somewhere else.',
    'The somewhere else is upstream. The flood at the top of the page took {lag} hours to get from the upstream end of the modelled reach to its outlet. That delay is the [[travel time|travel-time]], and it is set by the [[celerity]] of the flood wave. On the way the wave gets lower and broader, because the channel stores water as it passes and lets it go slowly. [[Muskingum routing|muskingum]] describes each [[reach]] with two numbers: K, its travel time, and X, how much water it holds ahead of the wave.',
    'That lag is what a model has to learn. A section’s future depends on what was happening upstream one travel time ago, and the delay is different for every reach.',
  ],
  figureTitle: 'One storm at two gauges',
  caption:
    'A [[hydrograph]] of one storm in basin 01, recorded at {up} (headwater) and {down} (mid-basin), {reaches} reaches apart. The downstream record is larger because local inflow joins along the way. Routing the headwater record alone through the same {reaches} reaches, with the dataset’s own K and X, isolates the wave: its peak arrives {lag} h later at {pct}% of its height. Drag across the plot or use the arrow keys to read values.',
}

export const approach = {
  heading: 'From a river to a graph, then to attention',
  intro:
    'Four steps, each resting on the one before. The order matters: attention only has something to weigh once the graph carries information a node does not already have.',
  morph: {
    before: 'The place',
    after: 'The graph',
    beforeLabel:
      'Plan view of the modelled Kabini reach in Wayanad: the greatest extent of the 2018 flood in the HEC-RAS model, coloured by depth, with the river’s centreline, survey lines across it at each cross-section, and {g} gauge towers on the bank.',
    afterLabel:
      'The same reach as a graph: {n} cross-sections are nodes, the {g} gauged ones filled; straight arrows join each cross-section to the next one downstream, and dashed arcs link places two and three reaches apart.',
    stageRiver: 'A real place: the Kabini valley, flooded as the model has it in 2018, with the river’s line and {g} gauges.',
    stageMid: 'The flood map goes, the winding river becomes straight reaches, each survey line becomes a point.',
    stageGraph: 'A graph: {n} nodes, {g} of them gauged; reaches as arrows; dashed links skip one or two places.',
    replay: 'Play it again',
    caption:
      'Representing a river as a graph keeps what a forecast needs — which place drains into which, and how far apart they are — and drops what it does not. This reach is a single channel {km} km long with no tributary, so its graph is a chain. The dashed links let a place hear from two or three places upstream in one step.',
  },
  // Step text lives in claims.ts (graph, passing, physics, attending).
  steps: [
    { title: 'The river as a directed graph' },
    { title: 'Message passing' },
    { title: 'Mass conservation in the loss' },
    { title: 'Attention' },
  ],
  equations: {
    continuity: {
      name: 'Saint-Venant continuity',
      plain:
        'Water is neither created nor lost along a reach. If more flows in than out, the wetted area A rises. q is local inflow per unit length of channel.',
    },
    muskingum: {
      name: 'Muskingum routing',
      plain:
        'Storage in a reach is a weighted mix of inflow I and outflow O. K is the travel time. X sets how much water sits in a wedge ahead of the wave: 0 behaves like a reservoir, 0.5 like pure translation. The three coefficients sum to one, so routing conserves mass exactly.',
    },
    residual: {
      name: 'Continuity residual in the loss',
      plain:
        'The same law, checked at each node in the model’s own predictions. Only physical reaches count; the message shortcuts would deliver the same water two or three times.',
    },
    attention: {
      name: 'GATv2 attention',
      plain:
        'Node i scores each incoming neighbour j from both states and the edge’s features — reach length and elevation drop — then normalises the scores to sum to one, including a self-loop. The hypothesis was that these weights would come to track travel time.',
    },
  },
}

export const attentionCopy = {
  heading: 'What uniform aggregation cannot say',
  paragraphs: [
    'A [[GCN|gcn]] averages its neighbours with weights fixed by the graph’s structure. At a [[confluence]] it gives a small tributary and a large main stem roughly the same say, and it treats a neighbour one reach away and one three reaches away as interchangeable. It has no way to express that influence arrives late.',
    '[[Attention]] can. Each incoming [[edge]] gets its own weight, and here the weights are recomputed at every hour of the 12-hour [[rollout]]. Switch between the two modes, pick a node, and scrub through the rollout.',
    'These are the trained model’s weights, not an illustration: last layer, averaged over three [[seeds|seed]], with the spread across seeds beside each value. At the confluence {conf}, the main-stem reach takes {ttMain} h and the tributary {ttTrib} h — genuinely different — and the weights do not follow that difference. They follow how much water each branch carries.',
  ],
  sceneLabel:
    'Synthetic basin 01 seen from above. Select a node to light up the edges that send it messages, one to three reaches upstream; the rest of the network dims. In learned mode, edge thickness and magenta show the attention weight; in uniform mode every incoming edge is drawn the same.',
  modes: { uniform: 'Uniform aggregation', learned: 'Learned attention' },
  stepLabel: 'Rollout hour',
  toConfluence: 'Go to the confluence',
  keyboard: 'Arrow keys walk the network: → downstream, ← upstream, ↑ across to the other branch.',
  panelTitle: 'Messages into {label}',
  selfRow: 'own state (self-loop)',
  uniformNote:
    'Uniform: every incoming message and the node’s own state weigh 1 / (in-degree + 1). The GCN baseline uses symmetric degree normalisation, which is likewise fixed by structure, not learned.',
  learnedNote:
    'Learned: GATv2, last layer, mean of 3 seeds. The pale band behind each bar spans the lowest to highest seed. Run {run}.',
  pendingLearned: 'Learned weights pending: no attention export found in the results directory.',
  hydroTitle: 'Discharge at {label}: 24 hours seen, 12 forecast',
  hydroNote: 'One representative test window from the dataset. Attention weights are averaged over all test windows.',
  tableToggle: 'Read the weights at the confluence as a table',
}

export const dataset = {
  heading: 'A synthetic river, built to be checked',
  paragraphs: [
    'Real [[gauge]] data cannot tell you whether a model has learned routing, because nobody knows the true travel time of each real reach. A synthetic network can: every reach has a known K, X and [[celerity]], so whatever the model learns can be checked against the answer.',
    'Eight basins were generated with different character — steep upland to coastal plain, celerity 0.70 to 1.95 m/s, Manning’s n from 0.021 to 0.058, one to three tributaries. Discharge is routed reach by reach with the Muskingum method, and [[mass balance|mass-balance]] closes at {massBalance} in every basin.',
    '[[Travel time|travel-time]] is reach length over wave celerity, with an 18% per-reach spread in celerity added on purpose so that length alone cannot stand in for it. Storms are localised by a 2-D kernel of width {kernel}, which leaves {dryRise}% of rising node-hours under a dry sky — samples that only the graph can explain. Reaches are long enough that the 12-hour horizon spans {horizon} mean travel times.',
    'Gauges were placed, not sampled: one headwater, one mid-basin, one tributary and one outlet gauge per basin, {gauged} of {nodes} nodes ({gaugedPct}%), matching the real network’s 4 of 28.',
  ],
  caveat:
    'This validates the method ahead of the real H1–H4 data. It does not replace it, and no number on this page is a claim about the real river.',
  basinsCaption: 'The eight basins. basin_07 and basin_08 are held out of training.',
  xs: {
    heading: 'One cross-section, {label}',
    body: 'A surveyed section at the mid-basin gauge. Raise the water surface and watch area, wetted perimeter and hydraulic radius change. Discharge follows from Manning’s equation with this section’s own roughness and bed slope from the dataset.',
    sceneLabel:
      'Three-dimensional cross-section of the channel at the mid-basin gauge, with a water surface whose height follows the stage slider.',
    stage: 'Stage above the bed',
  },
}

export const findings = {
  heading: 'Two results that went the other way',
  intro:
    'The most useful things this project measured were the ones that contradicted the plan. Both are given in full, because each changed what came next.',
  week4: {
    title: 'Week 4: the graph had nothing to add',
    paragraphs: [
      'The first version forecast discharge one to twelve hours ahead at every node, with every node’s own history available. A graph network could not reliably beat a graph-blind MLP. Over eight seeds it won on one basin of three ({gcnWin}%, {gcnWinCi}), was {gcnHeld}% on the held-out basin ({gcnHeldCi}), and was {variability} more variable across seeds there.',
      'A model-free test found why. Least squares on a node’s own 24-hour history explained R² = {ownR2} of its discharge one hour ahead. Adding every upstream neighbour’s history moved mean R² by {g6} at six hours and {g12} at twelve. There was no residual left for a neighbour to explain.',
      'That is a verdict on the task, not on graph networks: a node with its own gauge does not need its neighbours. So the task changed. Gauges were removed from {masked}% of nodes, storms were localised, and reaches were lengthened until the 12-hour horizon spanned {horizon} mean travel times.',
    ],
    gate:
      'Before any attention model was trained, the same test was re-run as a gate with a pass mark of ΔR² > 0.05. Upstream gauges now add {gateAll} at ungauged nodes on average, and {gateServed} where a gauged ancestor is in reach — {xAll} and {xServed} times the threshold. The gain grows with lead time, from {k1} at one hour to {k12} at twelve.',
    exception:
      'One basin fell short, at {b08}. Ten of its 26 ungauged nodes have no gauged ancestor in reach; restricted to nodes the graph can serve, it gains {b08s}. Across all basins only {coverage}% of ungauged nodes have a gauged ancestor within nine hops, which caps what any graph model can do for the rest.',
    chartCaption: 'Mean R² gained by adding upstream information, by forecast hour. Week 4 task against the Week 5 gate; the dashed line is the pass mark.',
  },
  trap: {
    title: 'The metric that scored an untrained model at 0.956',
    paragraphs: [
      'The planned interpretability test was within-node r: for each node, correlate the attention on its incoming edges with their travel times. Before reporting it, the metric was run on a GATv2 with random, untrained weights. It scored {untrained}.',
      'The cause is structural. Edges arriving at a node differ mainly by hop count — one, two or three reaches upstream — and both reach length, a legal model input, and travel time, the answer key, grow with hop count. Within a node they correlate at {confRange}. Any function of edge length passes.',
      'Reporting {untrained} would have been a false headline. The metric was replaced by a hop-stratified version that compares an edge only with others of the same hop count, scored against a permutation null that shuffles within the same groups. The evaluator now carries {tests} passing tests, including this case.',
      'On the trained model the honest number is {r} ({rCi}): chance. On routing edges alone it is {rRouting}, the wrong sign. The sign agrees in only {signs} basins, and reach length alone scores {confound} — higher than the learned attention, by {gap} ({gapCi}). Three seeds agree on their attention at only {seed}, so no single attention map can be read as the model’s structure.',
    ],
    pendingParagraph:
      'The trained model’s hop-stratified number is pending until the GAT run completes. Whatever it turns out to be, it will be reported against the permutation null and the reach-length baseline, not against zero.',
    pendingLabel: 'Hop-stratified r on the trained model, against a permutation null. Pending the GAT run.',
    chartCaption:
      'Within-node correlation with travel time, on one axis. The untrained model’s 0.956 sits on top of the hop-count confound that produced it. The trained model’s hop-stratified value sits at chance, with each basin’s value marked below it.',
  },
  learned: {
    title: 'What attention learned instead',
    paragraphs: [
      'At every confluence examined, the model put 0.25 to 0.30 of the weight on the main stem and 0.00 to 0.05 on the tributary, even where the two take nearly the same time to arrive. Against quantities the model can see, attention tracks upstream contributing area at {area} and upstream mean discharge at {q}, with the same sign in all 8 basins. It learned how much water a neighbour sends, not when that water arrives.',
      'That may be why the GAT beats the GCN — a degree-normalised average cannot weight a large main stem over a small tributary — but that link has not been tested directly. It is not the claim the project set out to make. The next experiment moves the question to the temporal axis, where lag would have to appear if it appears at all.',
    ],
    pending:
      'What attention tracks instead of travel time can only be measured once a trained GAT exists. The comparison will use the same five properties of the upstream neighbour shown below, all of them quantities the model can see.',
    chartCaption: 'Correlation of learned attention with five properties of the upstream neighbour, signed mean over 8 basins.',
  },
}

export const resultsCopy = {
  heading: 'What was measured',
  intro:
    'All four models come from one config-logged run — same dataset, harness, seeds 0 to 2 and early-stopping rule — so no difference here comes from a change of data or code. Discharge RMSE in m³/s, averaged over eight basins.',
  rolloutCaption:
    'Error by forecast hour, log scale. At gauged nodes error grows with lead time, as it should. At ungauged nodes it is flat or falling: with no good starting value to decay from, the model regresses from upstream state at every step, so lead time is not the axis of difficulty there.',
  gatStatement:
    'Pooled over all eight basins, the GAT’s ungauged error is {imp}% lower than the GCN’s, with a 95% interval of {ci}. The interval resamples basins and seeds rather than basin–seed pairs, which share both. {verdictSentence} Its 3-seed mean is lower in {basinsWon} basins, by under 1% in some and up to 18% in others. It is a modest gain rather than a step change, which is what was predicted in writing before training.',
  gatHolds: 'It excludes zero: the direction holds, the size is uncertain.',
  gatFails: 'It includes zero: on this analysis the gain is not established.',
  supersededNote: 'Replaced analysis: {old}.',
  heldHeading: 'Held-out basins, on their own',
  heldStatement:
    'The two basins held out of training are reported separately and never folded into the figure above. There the GAT’s error is {held}% lower, with a 95% interval of {ci}. {verdictSentence}',
  heldHolds: 'The interval excludes zero.',
  heldFails: 'With two basins and three seeds the interval includes zero, so transfer to unseen basins is not established.',
  trainCaption: 'Training basins: ungauged-node RMSE, mean over 12 forecast hours and 3 seeds (± seed s.d.), and the lowest to highest per-seed change.',
  heldCaption: 'Held-out basins, never trained on. Same measures.',
  ablationHeading: 'Ablations',
  ablationIntro: 'Each ablation changes one thing from the reference GAT and runs on the same 24 basin–seed pairs.',
  undirected:
    'Making the graph undirected changed error by {gain}% on average, better in only {betterIn} basin–seed pairs, with a 95% interval of {ci}. {verdictSentence} Replaced analysis: {old}. Water must flow downstream, and the physics loss still enforces that; information need not, since a downstream gauge constrains the section above it. The obvious mechanism — reverse edges helping where upstream coverage is poor — does not hold (r = {cov}), so the effect, whatever its size, is unexplained.',
  undirectedHolds: 'The interval excludes zero.',
  undirectedFails:
    'The interval includes zero: the gain is driven by large improvements in a few basins and losses in others, and on the clustered analysis it is not established.',
  ablationCaption:
    'GAT ungauged RMSE. Change vs reference is the mean per-pair relative change, with a 95% interval from resampling basins and seeds; a dashed rule marks an interval that includes zero.',
  tableHeading: 'Every number, with its status and source',
  tableIntro:
    'Verified: measured and rebuilt from the committed inputs in provenance/. Qualified: measured, with the limitation stated beside it. Pending: not yet measured, listed so its absence is visible. Recomputed values are calculated from the run outputs; read values are taken from RESULTS.md. Each row names the run and config hash behind it.',
}

export const rigor = {
  heading: 'How the claims are kept honest',
  items: [
    {
      title: 'Expectations in writing first',
      body: 'Predictions for each experiment were committed before the models trained. Week 5 predicted attention would help interpretability more than accuracy. The result was the reverse, and it is reported that way.',
    },
    {
      title: 'Seeded, config-logged runs',
      body: 'Every run writes its full config and a hash into its results directory, with fixed seeds throughout. A re-run of the Week 4 headline table after the final code changes reproduced it to four decimal places.',
    },
    {
      title: 'Intervals that respect the design',
      body: 'Comparisons are reported as effects with 95% intervals from a bootstrap that resamples basins and seeds, not basin–seed pairs, which share both. Where that changed a conclusion, the page reports the corrected one and names the test it replaced.',
    },
    {
      title: 'Permutation nulls and confound baselines',
      body: 'Attention statistics are compared with within-group shuffles, not with zero, and always beside what reach length alone would score, because length is a legal input that correlates with the answer.',
    },
    {
      title: 'Tests on the evaluator',
      body: 'The attention evaluator carries {tests} passing tests, including the hop-count confound that scored an untrained model at {untrained}.',
    },
    {
      title: 'Published inputs',
      body: 'The run outputs, configs, dataset tables and RESULTS.md behind every number are committed with this site. One command rebuilds the results file from them, and CI fails if it drifts.',
    },
    {
      title: 'Limits stated where they apply',
      body: 'Synthetic basins, three seeds, reaches of 17 to 56 km — long for a real gauging network. Each limit is written beside the result it constrains.',
    },
  ],
}

export const footer = {
  pending: 'Every result on this page comes from synthetic basins or from HEC-RAS model output for Wayanad, which has not yet been validated against observations. Results on real gauge data (H1–H4) are pending.',
  provenance:
    'Every number is rebuilt from the committed inputs in provenance/ with npm run regen-data. Thesis commit {commit}, dataset version {dataset}, main run {run} (config hash {hash}).',
  provenanceLink: 'Inputs and run records',
  links: [
    { label: 'GitHub', href: 'https://github.com/pardhasaradhimenda26' },
  ],
}

/** Replace {name} placeholders. Unknown names are left visible on purpose. */
export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
