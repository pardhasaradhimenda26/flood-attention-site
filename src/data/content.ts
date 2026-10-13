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
}

export const hero = {
  headline: 'Four gauges, twenty-eight cross-sections. Forecasting the flood at the other twenty-four.',
  lede:
    'A temporal graph attention network that passes messages down a river network to forecast discharge where nothing is measured. Built and tested on eight synthetic basins with the real network’s proportions, ahead of the real gauge record.',
  readings: [
    { metric: 'real_ungauged', caption: 'of the real network’s cross-sections have no gauge' },
    { metric: 'gat_vs_gcn', caption: 'lower error than a GCN at ungauged sections, across eight synthetic basins' },
    {
      metric: 'att_tt_r',
      caption: 'correlation between learned attention and travel time. Chance level — see findings',
      pendingCaption: 'correlation between learned attention and travel time, once the GAT run is in',
    },
  ],
  sceneLabel:
    'Three-dimensional model of synthetic basin 01. An 18-node main stem and two tributaries lie in a valley. A flood pulse released at the three headwaters travels downstream, reaching each cross-section after the summed travel time of the reaches above it, and growing dimmer and broader as it goes. Four gauged sections carry staff gauges.',
  clockLabel: 'Hours since release',
  replay: 'Release again',
  settled: 'First pass complete',
  frozen: 'Reduced motion: held at the moment the main-stem peak reaches the confluence',
  tableSummary: 'Wave arrival at each gauge, from the summed travel time of the reaches above it',
}

export const problem = {
  heading: 'Most of a river is never measured',
  paragraphs: [
    'The real network this thesis targets has {sections} surveyed cross-sections and {gauges} gauges, H1 to H4. At {unmeasured} of the {sections} sections — {pct}% — there is no record of discharge or stage at all. A forecast there has to come from somewhere else.',
    'The somewhere else is upstream. A flood wave released in the headwaters reaches a downstream section hours or days later, lower and broader, because the channel stores water as the wave passes and releases it slowly. Muskingum routing describes a reach with two numbers: K, its travel time, and X, how much water it holds in a wedge ahead of the wave.',
    'That lag is what a model has to learn. A section’s future depends on what was happening upstream one travel time ago, and the delay is different for every reach.',
  ],
  figureTitle: 'One storm at two gauges',
  caption:
    'One storm in basin 01, recorded at {up} (headwater) and {down} (mid-basin), {reaches} reaches apart. The downstream record is larger because local inflow joins along the way. Routing the headwater record alone through the same {reaches} reaches, with the dataset’s own K and X, isolates the wave: its peak arrives {lag} h later at {pct}% of its height. Drag across the plot or use the arrow keys to read values.',
}

export const approach = {
  heading: 'From a river to a graph, then to attention',
  intro:
    'Four steps, each resting on the one before. The order matters: attention only has something to weigh once the graph carries information a node does not already have.',
  steps: [
    {
      title: 'The river as a directed graph',
      body: 'Each surveyed cross-section is a node and each reach an edge pointing downstream. Across eight basins that is {nodes} nodes and {edges} edges: {routing} reaches that water flows through, and {message} message-only shortcuts reaching two or three reaches upstream.',
    },
    {
      title: 'Message passing',
      body: 'Three message-passing layers over edges of up to three hops give each node a receptive field of nine reaches upstream. Gauged nodes receive observed discharge and depth. Ungauged nodes receive zeros and a mask, and have to be filled in from their neighbours.',
    },
    {
      title: 'Mass conservation in the loss',
      body: 'The loss adds a continuity residual at every node: inflow from upstream reaches, plus local inflow, minus outflow, minus the change in storage. It is weighted at 0.05 and acts as a regulariser, because the residual has a floor near 3% that the data itself does not meet. Travel time appears nowhere in the loss.',
    },
    {
      title: 'Attention',
      body: 'GATv2 replaces the GCN’s fixed, degree-normalised average with a learned weight on each incoming edge, recomputed at every rollout step. Encoder, depth, width, loss, seeds, splits and early stopping are held identical, so the comparison isolates the aggregation.',
    },
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
    'A GCN averages its neighbours with weights fixed by the graph’s structure. At a confluence it gives a small tributary and a large main stem roughly the same say, and it treats a neighbour one reach away and one three reaches away as interchangeable. It has no way to express that influence arrives late.',
    'Attention can. Each incoming edge gets its own weight, and here the weights are recomputed at every hour of the 12-hour rollout. Switch between the two modes, pick a node, and scrub through the rollout.',
    'These are the trained model’s weights, not an illustration: last layer, averaged over three seeds, with the spread across seeds beside each value. At the confluence {conf}, the main-stem reach takes {ttMain} h and the tributary {ttTrib} h — genuinely different — and the weights do not follow that difference. They follow how much water each branch carries.',
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
    'Real gauge data cannot tell you whether a model has learned routing, because nobody knows the true travel time of each real reach. A synthetic network can: every reach has a known K, X and celerity, so whatever the model learns can be checked against the answer.',
    'Eight basins were generated with different character — steep upland to coastal plain, celerity 0.70 to 1.95 m/s, Manning’s n from 0.021 to 0.058, one to three tributaries. Discharge is routed reach by reach with the Muskingum method, and mass balance closes at {massBalance} in every basin.',
    'Travel time is reach length over wave celerity, with an 18% per-reach spread in celerity added on purpose so that length alone cannot stand in for it. Storms are localised by a 2-D kernel of width {kernel}, which leaves {dryRise}% of rising node-hours under a dry sky — samples that only the graph can explain. Reaches are long enough that the 12-hour horizon spans {horizon} mean travel times.',
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
      'The first version forecast discharge one to twelve hours ahead at every node, with every node’s own history available. A graph network could not reliably beat a graph-blind MLP. It won on one basin of three ({gcnWin}%, p = 0.039), was 15% worse on the held-out basin, and was two to four times more variable across seeds.',
      'A model-free test found why. Least squares on a node’s own 24-hour history explained R² = {ownR2} of its discharge one hour ahead. Adding every upstream neighbour’s history moved mean R² by {g6} at six hours and {g12} at twelve. There was no residual left for a neighbour to explain.',
      'That is a verdict on the task, not on graph networks: a node with its own gauge does not need its neighbours. So the task changed. Gauges were masked at 86% of nodes, storms were localised, and reaches were lengthened until the 12-hour horizon spanned 1.57 travel times.',
    ],
    gate:
      'Before any attention model was trained, the same test was re-run as a gate with a pass mark of ΔR² > 0.05. Upstream gauges now add {gateAll} at ungauged nodes on average, and {gateServed} where a gauged ancestor is in reach — 3.6 and 4.8 times the threshold. The gain grows with lead time, from {k1} at one hour to {k12} at twelve.',
    exception:
      'One basin fell short, at {b08}. Ten of its 26 ungauged nodes have no gauged ancestor in reach; restricted to nodes the graph can serve, it gains {b08s}. Across all basins only {coverage}% of ungauged nodes have a gauged ancestor within nine hops, which caps what any graph model can do for the rest.',
    chartCaption: 'Mean R² gained by adding upstream information, by forecast hour. Week 4 task against the Week 5 gate; the dashed line is the pass mark.',
  },
  trap: {
    title: 'The metric that scored an untrained model at 0.956',
    paragraphs: [
      'The planned interpretability test was within-node r: for each node, correlate the attention on its incoming edges with their travel times. Before reporting it, the metric was run on a GATv2 with random, untrained weights. It scored 0.956.',
      'The cause is structural. Edges arriving at a node differ mainly by hop count — one, two or three reaches upstream — and both reach length, a legal model input, and travel time, the answer key, grow with hop count. Within a node they correlate at +0.97 to +0.99. Any function of edge length passes.',
      'Reporting 0.956 would have been a false headline. The metric was replaced by a hop-stratified version that compares an edge only with others of the same hop count, scored against a permutation null that shuffles within the same groups. The evaluator now carries 33 passing tests, including this case.',
      'On the trained model the honest number is {r}: chance. The sign agrees in only {signs} basins, the four significant basins split in both directions, and it does not beat the reach-length baseline of {confound}.',
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
      'At every confluence examined, the model put about a quarter of the weight on the main stem and almost none on the tributary, even where the two take nearly the same time to arrive. Against quantities the model can see, attention tracks upstream contributing area at {area} and upstream mean discharge at {q}, with the same sign in all 8 basins. It learned how much water a neighbour sends, not when that water arrives.',
      'That is hydrologically sensible, and probably why the GAT beats the GCN: a degree-normalised average cannot weight a large main stem over a small tributary. It is not the claim the project set out to make. The next experiment moves the question to the temporal axis, where lag would have to appear if it appears at all.',
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
    'The GAT beats the GCN at ungauged nodes in {basinsWon} basins, by {imp}% pooled ({pNote}). With three seeds the held-out estimate ({held}%) is not significant. It is a modest, consistent gain rather than a step change, which is what was predicted in writing before training.',
  basinsCaption:
    'Ungauged-node RMSE by basin, mean over 12 forecast hours and 3 seeds (± seed s.d.). basin_07 and basin_08 were held out of training.',
  ablationHeading: 'Ablations',
  ablationIntro: 'Each ablation changes one thing from the reference GAT and runs on the same 24 basin–seed pairs.',
  undirected:
    'Making the graph undirected improved accuracy by {gain}% (p = {p}), more than the entire GAT-over-GCN gain. Water must flow downstream, and the physics loss still enforces that. Information need not: a downstream gauge constrains the section above it. The obvious mechanism — reverse edges helping where upstream coverage is poor — does not hold (r = {cov}), so the effect is recorded as unexplained.',
  ablationCaption: 'GAT ungauged RMSE. Change vs reference is the mean per-pair relative change; p from a one-sample t-test on those changes.',
  tableHeading: 'Every number, with its source',
  tableIntro: 'Pending rows have not been measured. They are listed so their absence is visible.',
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
      body: 'Every run writes its full config and a hash into its results directory, with seeds 0, 1 and 2 throughout. A re-run of a headline table after the final code changes produced byte-identical metrics.',
    },
    {
      title: 'Permutation nulls',
      body: 'Attention statistics are compared with 1,000 within-group shuffles, not with zero.',
    },
    {
      title: 'Confound baselines',
      body: 'Each attention result is reported beside what reach length alone would score, because length is a legal input that correlates with the answer.',
    },
    {
      title: 'Tests on the evaluator',
      body: '33 passing tests on the attention evaluator, including the hop-count confound that scored an untrained model at 0.956.',
    },
    {
      title: 'Limits stated where they apply',
      body: 'Synthetic basins, three seeds, reaches of 17 to 56 km — long for a real gauging network. Each limit is written beside the result it constrains.',
    },
  ],
}

export const footer = {
  pending: 'Every result on this page comes from synthetic basins. Results on real gauge data (H1–H4) are pending.',
  provenance: 'Numbers are generated from the thesis repository by scripts/generate_data.py ({mode}; run {run}).',
  links: [
    { label: 'GitHub', href: 'https://github.com/pardhasaradhimenda26' },
  ],
}

/** Replace {name} placeholders. Unknown names are left visible on purpose. */
export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
