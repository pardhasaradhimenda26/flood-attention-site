# Week 5 — Fix the Task, Then Add Attention

> **Week 4's finding, for context:** the GCN did not reliably beat a graph-blind
> MLP, because a node's own 24-step history explained R² = 0.9998 of its
> 1-hour-ahead discharge and the graph had nothing left to add. Week 5 changes
> the task so the graph is load-bearing, then gates the attention work on a
> re-run of that test. The Week 4 report is preserved verbatim below.

## W5.0 Expectation, recorded in advance

*Written and committed before any Week 5 model was trained, so that it reads as
a prediction rather than a rationalisation. The commit history is the evidence.*

Attention is unlikely to produce a large accuracy gain over the GCN. The graphs
are small and Muskingum routing is close to linear, so uniform aggregation is
already a reasonable approximation of it. The contribution is expected to appear
in two other places:

- **(a) Interpretability** — attention weights recovering hydraulic travel time
  above chance, measured as `within_node_r` against a permutation null.
- **(b) Long-horizon error** — per-rollout-step RMSE at the far end of the
  12-step horizon, where better-targeted message passing should slow the
  compounding of error.

If accuracy gains are modest but the interpretability result is strong, that is
the expected outcome and the thesis stands on it.

Two further predictions, recorded at the same time:

- The MLP should **collapse at ungauged nodes**. It has no own-history there, so
  it can only regress on local forcing and static attributes. Persistence should
  be worse still, since at an ungauged node it has nothing at all to persist.
- The graph's advantage should **grow with lead time**, because the gate test
  already shows ΔR² rising from +0.236 at k=1 to +0.247 at k=12.

---

## W5.1 Part A — fixing the task

Week 4 diagnosed three design errors. All three are addressed.

### A1 Masked gauges

`nodes.csv` gains `is_gauged`, `gauge_role`, `coord_x`, `coord_y`.

| | |
|---|---|
| gauged | **32 of 233 nodes = 13.7%** (real dataset: 4 of 28 = 14.3%) |
| roles | 8 headwater, 8 mid-basin, 8 outlet, 8 tributary — one of each per basin |
| placement | deliberate, not random |

Models receive observed `discharge_m3s` and `water_depth_m` **only at gauged
nodes**. Elsewhere those inputs are zeroed *after* normalisation, so a masked
value reads as the training mean rather than a spurious extreme, and the mask
itself is handed to the model as a feature. Static attributes, precipitation and
lateral inflow remain available everywhere — they stand in for a DEM and a met
product, which are basin-wide in reality. Models predict at **all** nodes.

### A2 Localised storms

The spatial kernel went from a 1-D Gaussian of width 0.45 over node index to a
**2-D Gaussian of width 0.18** over (along-flow position, branch offset), with
elongated cells, centres drawn from a box extending past the basin, and a 1%
floor below which a cell is simply not raining on that node. Background drizzle
dropped from gamma(0.35, 0.30) to gamma(0.15, 0.12) so dry regions are genuinely
dry rather than uniformly damp.

Verification is check `[i]`, which counts the situation the change exists to
create — a node whose discharge is climbing while it sits under dry sky:

| basin | rising node-hours under dry sky |
|---|---|
| basin_01 | 17.7% |
| basin_05 | 14.6% |
| basin_07 | 13.7% |
| basin_04 | 12.9% |
| basin_03 | 9.9% |
| basin_06 | 8.7% |
| basin_02 | 7.8% |
| basin_08 | 7.5% |
| **overall** | **12.0%** |

Those are the samples local forcing cannot explain and only the graph can.

### A3 Horizon aligned with travel time

**Decision: lengthen reaches, keep `rollout_steps: 12`.** Recorded reasoning:

1. `rollout_steps` is a frozen-config value; keeping it preserves comparability
   of the harness with Week 4.
2. Shortening the rollout to ~3 steps would delete the long-horizon regime where
   the advance expectation says attention should help. That is half the
   contribution we want to measure — removing it to satisfy a ratio would be
   optimising the wrong thing.
3. Longer reaches also make the 2- and 3-hop message edges genuinely
   long-lagged, rather than near-duplicates of the 1-hop edge.

Result: reaches are 17–56 km, mean 1-hop travel time **7.64 h** (range
3.43–18.95 h), so the 12-step rollout is **1.57× mean travel time**, inside the
1–2× target. Per basin it ranges 1.24× (basin_06) to 2.28× (basin_01).

The honest caveat: 17–56 km between cross-sections is long for a real gauging
network. Travel time is the quantity the experiment needs to control, and it is
reached here through reach length at realistic celerities (0.70–1.95 m/s) rather
than through implausibly slow water.

### A4 Larger graph

| | Week 4 | Week 5 |
|---|---|---|
| basins | 3 | **8** |
| nodes | 39 | **233** (21–34 per basin) |
| edges | 99 | **651** (225 routing + 426 message-only) |
| tributaries per basin | 1 | **1 to 3** (varies) |
| nodes with ≥2 incoming edges | 3 / 39 | **183 / 233** |

Basin character varies far more widely: headwater elevation 42–1680 m, slope
0.0002–0.029, celerity 0.70–1.95 m/s, Manning n 0.021–0.058, area scale
0.45–2.10, runoff coefficient 0.28–0.68, and tributary count 1–3.

### A5 Verification

| check | result |
|---|---|
| Mass balance | **1.0000 in all 8 basins** (see note below) |
| DAG assertions, no reverse edges | pass, all 8 basins |
| Multi-hop accumulation | 426 edges walked along their own path — 0 drift, 0 non-monotonic |
| Naive cross-correlation, **re-derived** | **r = 0.698** routing edges, **r = 0.769** all edges |

**Three corrections made while verifying, each a real defect:**

1. **Mass balance was mis-measured, not broken.** `muskingum_route` starts each
   reach at steady state (`out[0] = q[0]`), which means every reach begins
   pre-filled with `S₀ = K·Q₀` of water that was never counted as input. With
   Week 5's much larger `K` that pre-fill drains out during the run and made
   outflow *exceed* accounted inflow — by 0.6% in the fastest basin and 2.3% in
   the slowest, exactly in order of `K`. Charging it to the input side, and
   adding a zero-rainfall drainage tail (240–638 h, sized per basin) so water
   still in transit is not counted as loss, gives exactly 1.0000 everywhere.
   Week 4's 0.9997 was two errors partly cancelling.
2. **The attenuation check `[c]` was reporting fictional physics.** Its pulse
   array was 200 h long while a Week 5 main stem takes 200–450 h to traverse, so
   basin_06 reported 100% attenuation — the wave had simply routed off the end of
   the array. Sizing the array from the chain's own travel time gives a sensible
   61.5%.
3. **The multi-hop monotonicity check was wrong in Week 4 and only now failed.**
   It compared each multi-hop edge against *every* 1-hop edge into the same
   target, including edges on a different branch. That is not a monotonicity
   claim: at a confluence a slow tributary reach can legitimately take longer
   than a fast 2-hop main-stem path. It passed in Week 4 only because per-edge
   celerity varied 8%; at Week 5's 18% it failed on one edge. Replaced with the
   correct containment check — walk each multi-hop edge along its own path and
   verify the accumulation is exact and every prefix strictly shorter.

**Also raised deliberately: per-edge celerity spread, 8% → 18%.**
`reach_length_m` is a legal model input and `travel_time_hours` is the answer
key, so if `K = L/c` were nearly a deterministic function of `L`, "attention
recovers travel time" would reduce to "attention reads off edge length". Check
`[j]` now reports that risk explicitly: within-basin
`r(reach_length, travel_time)` is **+0.505** (range +0.221 to +0.739) and pooled
across basins it is **−0.112**. Length alone does not determine travel time.

---

## W5.2 Part A GATE — information at ungauged nodes

Re-run of Week 4's model-free test under the new task, with own-history withheld
at ungauged nodes. Ridge least squares, fitted on the first 70% of the record and
scored out-of-sample on the last 30%. Receptive field is 9 routing-hops upstream,
matching `n_layers` (3) × `max_hops` (3), so the test measures what the model can
actually reach rather than a 1-hop strawman. Travel time, `K`, `X` and celerity
appear nowhere in it; distance to the upstream gauge is accumulated
`reach_length_m`, which is a legal input.

- **BASELINE** — static node attributes + the node's own local forcing.
- **+GRAPH** — the same, plus the nearest upstream *gauged* node's history and
  the mean over all upstream gauged nodes in reach.

| scope | mean ΔR² | sign consistent |
|---|---|---|
| all ungauged nodes | **+0.1809** | 7 / 8 basins |
| ungauged nodes with a gauged ancestor in reach | **+0.2416** | **8 / 8 basins** |

Per-lead, on covered nodes: **+0.2363** (k=1), **+0.2411** (k=6), **+0.2474**
(k=12).

### GATE: PASS, with the exception recorded

The magnitude condition (mean ΔR² > 0.05) clears by **3.6× on the all-ungauged
scope and 4.8× on covered nodes**. The sign condition holds in all 8 basins on
covered nodes.

It fails on the all-ungauged scope in exactly one basin, basin_08, by **−0.005**
— about 2% the size of the mean gain. The cause is identified rather than
assumed: 10 of basin_08's 26 ungauged nodes have no gauged ancestor within reach,
so for those samples the graph block is ~37 all-zero columns that spend ridge
budget and buy nothing. Restricting to nodes the graph can actually serve flips
basin_08 to **+0.012** at every lead.

This is qualitatively unlike Week 4's failure, where the spread ran −0.89 to
+0.13 and the ordering was *backwards* — the GCN won the basin with the least
available information. Here the effect is large, positive in every basin the
graph can reach, and **grows with lead time**, which is what the thesis needs.

**One limitation to carry forward.** Only **126 of 201 ungauged nodes (63%)**
have a gauged ancestor within 9 routing-hops. For the other 37% the graph
structurally cannot help, and no amount of attention will change that. This caps
the achievable GNN advantage on the all-node metric and should be read into every
ungauged number that follows.

---

## W5.3 Part A′ — baselines re-run on the new dataset

Every Week 4 number is stale. Persistence, the graph-blind MLP and the GCN were
re-run on the Week 5 dataset under `configs/week5.yaml`, alongside the GAT, in
one config-logged run (`20260830-192452-1440f965dd-main`, hash `1440f965dd`,
seeds 0/1/2). All four models come from the same run, so the comparison is not
across datasets or harness versions.

**Ungauged nodes — mean RMSE across the 12-step horizon, discharge (m³/s):**

| basin | persistence | MLP | GCN | **GAT** | GAT vs MLP |
|---|---|---|---|---|---|
| basin_01 | 8.603 | 2.992 | 1.095 | **1.091** | +63.5% |
| basin_02 | 10.999 | 4.862 | 3.674 | **3.670** | +24.5% |
| basin_03 | 15.828 | 7.745 | 5.083 | **4.541** | +41.4% |
| basin_04 | 12.274 | 8.357 | 2.758 | **2.254** | +73.0% |
| basin_05 | 11.322 | 4.422 | 2.245 | **1.856** | +58.0% |
| basin_06 | 26.671 | 9.088 | 8.392 | **8.107** | +10.8% |
| basin_07 **(held out)** | 10.618 | 6.113 | 3.249 | **2.914** | +52.3% |
| basin_08 **(held out)** | 13.417 | 4.768 | 4.442 | **4.096** | +14.1% |

**The Week 4 finding is reversed.** In Week 4 the GCN could not reliably beat
the graph-blind MLP. Here both GNNs beat it in **8 of 8 basins**, by 10.8% to
73.0%. Fixing the task, not changing the model, is what produced that.

Both predictions recorded in advance held:

- **The MLP collapses at ungauged nodes**, exactly as predicted. At gauged nodes
  it is the best or near-best model (1.44–2.98 RMSE); at ungauged nodes it is
  2–4× worse than the GNNs. With no own-history to autoregress on it has only
  local forcing and static attributes.
- **Persistence is worse still** — 8.6 to 26.7 RMSE. At an ungauged node it has
  literally nothing to persist and degenerates to predicting climatology, which
  is the honest floor rather than a defect.

**An unexpected structural feature, worth recording.** At ungauged nodes error
does **not** grow with lead time — it is flat or *falling* (GAT 4.24 at t+1 h,
3.35 at t+12 h). At gauged nodes it grows normally (persistence 0.36 → 3.99).
The reason is that an ungauged node has no good initial condition to decay away
from: the model is effectively doing regression from forcing and upstream state
at every step, rather than propagating an accurate starting value forward. This
inverts the usual error-growth picture and means "error at long lead time" is
not the right difficulty axis for the ungauged task.

---

## W5.4 Part B1 — GAT vs GCN

`GATv2Conv` with `edge_dim=2`, single head, swapped in for `GCNConv` with
**nothing else changed**: same encoder, depth, width, LayerNorm, residuals,
zero-initialised head, delta parameterisation, loss, lambdas, splits, seeds and
early-stopping rule.

**GAT beats GCN at ungauged nodes in 8 of 8 basins.**

| basin | GCN | GAT | GAT vs GCN |
|---|---|---|---|
| basin_01 | 1.095 ± 0.105 | 1.091 ± 0.096 | +0.30% |
| basin_02 | 3.674 ± 0.369 | 3.670 ± 0.060 | +0.11% |
| basin_03 | 5.083 ± 0.046 | 4.541 ± 0.061 | +10.66% |
| basin_04 | 2.758 ± 0.118 | 2.254 ± 0.089 | **+18.28%** |
| basin_05 | 2.245 ± 0.110 | 1.856 ± 0.041 | **+17.34%** |
| basin_06 | 8.392 ± 0.380 | 8.107 ± 0.114 | +3.40% |
| basin_07 (held out) | 3.249 ± 0.148 | 2.914 ± 0.204 | +10.33% |
| basin_08 (held out) | 4.442 ± 0.420 | 4.096 ± 0.294 | +7.79% |

Pooled over basins, per seed:

| | GAT | GCN | difference |
|---|---|---|---|
| all basins | 3.566 ± 0.049 | 3.867 ± 0.056 | **+7.79%**, paired *t* p = **0.038** |
| held-out only | 3.505 ± 0.095 | 3.846 ± 0.173 | +8.86%, paired *t* p = 0.159 |
| per (basin, seed) pair | — | — | GAT better in **17 / 24**, *t* p = **1.3e-03** |

GAT also reaches a better validation loss on every seed (0.1014–0.1020 against
the GCN's 0.1071–0.1195), and every run converged — early stopping fired between
epochs 33 and 40 of a 40-epoch budget.

**Read this honestly.** The pooled result is significant, but with 3 seeds the
held-out-only comparison is underpowered (p = 0.159) despite a larger point
estimate. The per-(basin, seed) test is the strongest evidence, and it also
shows the win is not uniform: 7 of 24 individual pairs favour the GCN. The
gain is real and consistent in direction, but it is a **7–9% improvement, not a
step change** — which is what the advance expectation predicted.

**Error against lead time** (ungauged, mean over 8 basins):

| lead | GCN | GAT | GAT vs GCN |
|---|---|---|---|
| t+1 h | 4.579 | 4.238 | +7.44% |
| t+4 h | 3.974 | 3.666 | +7.75% |
| **t+7 h** | 3.780 | 3.415 | **+9.66%** |
| t+9 h | 3.635 | 3.328 | +8.42% |
| t+12 h | 3.542 | 3.350 | +5.42% |

The advance expectation predicted the advantage would **grow** with lead time.
It grows to a peak near t+6 to t+8 h and then **falls back** to +5.4% by t+12 h.
That peak sits close to the 7.64 h mean edge travel time, which is the natural
reading: attention helps most over the window in which upstream water is
actually in transit, and past that the routed signal has already arrived and
there is less left to weight. The prediction was half right, and the half that
was wrong is informative.

---

## W5.5 Part C — attention evaluation

### The headline: attention does NOT recover travel time

Reported as `hop_stratified_within_node_r` with a 1000-draw permutation null,
against **both** reference baselines, as required.

| basin | r (all edges) | p | r (routing) | p |
|---|---|---|---|---|
| basin_01 | **+0.733** | 0.002 | +0.756 | 0.671 |
| basin_02 | −0.181 | 0.594 | +0.066 | 1.000 |
| basin_03 | **+0.417** | 0.049 | +0.150 | 1.000 |
| basin_04 | −0.605 | 0.101 | −1.000 | 1.000 |
| basin_05 | −0.108 | 0.615 | −0.229 | 0.831 |
| basin_06 | **+0.714** | 0.002 | +0.774 | 0.503 |
| basin_07 | **−0.670** | 0.009 | −0.751 | 0.248 |
| basin_08 | −0.162 | 0.502 | −0.798 | 0.503 |

| | value |
|---|---|
| mean hop-stratified r, all message edges | **+0.017** |
| mean hop-stratified r, routing edges | **−0.129** |
| sign consistent across basins | **3 / 8** |
| basins significant at p < 0.05 | 4 / 8 — **but in both directions** |
| reach-length confound baseline | +0.438 |
| beats the length confound | **No** |
| reference to beat (routing / all edges) | 0.698 / 0.769 |

Four basins reach significance, but two are strongly positive (+0.73, +0.71) and
one strongly negative (−0.67). A model recovering a universal hydraulic quantity
would correlate positively everywhere. The signed mean is **+0.017** — chance.

This is **not** an artefact of which layer or which rollout step is read. The
pattern is stable across all three message-passing layers, and each basin keeps
its sign in every layer:

| layer | signed mean r | mean abs r | mean entropy |
|---|---|---|---|
| 0 | +0.021 | 0.422 | 0.907 |
| 1 | +0.009 | 0.416 | 0.945 |
| 2 | +0.017 | 0.449 | 0.938 |

So attention *is* strongly structured within each basin (|r| ≈ 0.42–0.45) and
that structure is reproducible across layers. It simply is not travel time.

### What attention actually learned

The confluence heatmaps gave it away: at every confluence examined the model
puts ~0.25–0.30 of its weight on the main stem and ~0.00–0.05 on the tributary,
**even where the two have nearly identical travel times** (6.4 h vs 6.3 h in
basin_01; 10.6 h vs 10.9 h in basin_03). Testing that hypothesis directly,
against quantities that are all legal model inputs or derivable from them:

| attention correlates with | signed mean r | sign consistent | significant at p<0.05 |
|---|---|---|---|
| **upstream local area** | **+0.870** | **8 / 8** | — |
| upstream mean discharge | +0.845 | **8 / 8** | **8 / 8** |
| upstream drainage area | +0.844 | **8 / 8** | **8 / 8** |
| reach length | +0.062 | 5 / 8 | — |
| **travel_time_hours** *(the thesis claim)* | **+0.017** | **3 / 8** | 4 / 8, both directions |

**Attention learned to weight upstream neighbours by how much water they
contribute, not by how long that water takes to arrive.** That is
hydrologically sensible, it is almost certainly *why* the GAT beats the GCN's
degree-normalised uniform aggregation, and it is a clean mechanistic
explanation for both results at once. It is also emphatically not the
"attention aligns with hydraulic travel time" claim the project was built on.

### Sparsity (attention entropy)

Mean normalised entropy **0.875** (1.0 = uniform over incoming edges, 0.0 =
one-hot), per-layer 0.907 / 0.945 / 0.938. Attention is close to uniform. It is
selective enough to beat the GCN, but it is not learning a sparse routing
structure, and any claim of "sparse, interpretable attention" would not survive
this number.

### Consistency across seeds

| basin | mean r between seeds | range |
|---|---|---|
| basin_06 | +0.616 | +0.35 to +0.81 |
| basin_08 | +0.508 | +0.15 to +0.84 |
| basin_03 | +0.465 | +0.14 to +0.74 |
| basin_05 | +0.410 | −0.04 to +0.71 |
| basin_07 | +0.346 | −0.16 to +0.74 |
| basin_02 | +0.342 | −0.13 to +0.75 |
| basin_01 | +0.219 | −0.34 to +0.71 |
| basin_04 | +0.185 | −0.42 to +0.66 |
| **overall** | **+0.386** | — |

Different seeds learn only **moderately** similar attention, and individual seed
pairs range from −0.42 to +0.84. Attention is not arbitrary, but it is not
stable enough for a single run's attention map to be presented as *the*
learned structure. Any attention figure in the thesis should be shown across
seeds, not from one.

### The measurement trap this section avoided

The metric Week 4 recommended, plain `within_node_r`, is **unusable on this
graph**. Edges arriving at a node differ mainly by hop count, and both
`reach_length_m` (a legal input) and `travel_time_hours` (the answer key)
increase with it, correlating within-node at **+0.97 to +0.99** in every basin.
An **untrained** GATv2 with `edge_dim=2` scores **0.956** on it.

Had that been the reported number, Week 5 would have claimed "attention recovers
travel time at r ≈ 0.96" while the honest, hop-stratified figure is **+0.017**.
`hop_stratified_within_node_r` groups edges by (target node, hop count) before
centring, so hop count cannot answer the question, and its permutation null
shuffles within those same groups. `attention_eval.py` now carries 33 passing
tests including this confound case.

---

## W5.6 Part B3 — ablations

Each ablation changes exactly one thing from the B1 configuration and runs on
the same 3 seeds, same loss, same lambdas, same splits, same early stopping.
Significance is a paired test over all 24 (basin, seed) pairs against B1.

| ablation | ungauged RMSE | vs B1 | *p* | better in | attention r vs travel time |
|---|---|---|---|---|---|
| **B1 reference** (1 head, `edge_dim=2`, directed) | 3.566 | — | — | — | +0.017 |
| **undirected** | **2.931** | **+11.13%** | **0.012** | 14/24 | +0.025 |
| Time2Vec | 3.491 | +4.01% | 0.051 | 17/24 | +0.013 |
| `edge_dim=0` (no edge features) | 3.520 | +2.10% | 0.236 | 15/24 | +0.013 |
| 2 heads | 3.512 | +1.50% | 0.386 | 13/24 | +0.077 |
| 4 heads | 3.591 | −3.32% | 0.303 | 9/24 | +0.058 |
| 8 heads | 3.549 | +0.01% | 0.996 | 12/24 | +0.087 |

### Does one-way flow structure matter? — the most important ablation

**Making the graph undirected improves accuracy by 11.1% (p = 0.012), the
largest effect of any ablation, and it is larger than the entire GAT-over-GCN
gain.** It also improves the held-out basins (3.051 vs 3.505).

This directly challenges the project's standing "direction is the physics"
constraint. The constraint is correct for **water**: routing must stay one-way
or mass balance breaks, and it still does — the physics loss and the dataset
generator are untouched here. But this task is *inference*, and information is
not water. A downstream gauge constrains the state of an ungauged section
upstream of it, and in the directed graph that constraint can never reach the
node.

**The mechanism is not confirmed, and I am not going to claim it is.** The
obvious hypothesis is that reverse edges help most where upstream gauge
coverage is worst. That hypothesis **fails**: the correlation between a basin's
upstream gauge coverage and its undirected gain is **−0.06**, essentially zero.
Worse, the effect is wildly heterogeneous — +36.2% in basin_02 and +29.4% in
basin_06, but **−15.0% in basin_04 and −3.6% in basin_05** — and it wins only
14 of 24 (basin, seed) pairs. So the aggregate is significant and large, driven
by big gains in a few basins rather than a consistent shift.

Recommendation: treat this as the highest-priority Week 6 investigation, not as
a settled result. It is a deliberate ablation that came back stronger than the
headline contribution, which is worth understanding before the thesis commits
to a directed architecture.

### Does distance information help attention? — no

`edge_dim=0` removes `reach_length_m` and `elevation_drop_m` from attention
entirely, and accuracy does not change (+2.1%, p = 0.236). The edge features the
GAT was given specifically so it could weigh distance **contribute nothing
measurable**. This is consistent with W5.5: attention is tracking upstream flow
magnitude, which it reads from node features, not from edge geometry.

### How much attention capacity does this graph need? — one head

2, 4 and 8 heads are all statistically indistinguishable from a single head
(p = 0.39, 0.30, 1.00), and 4 heads is nominally worse. There is no capacity
benefit. More heads do nudge the travel-time correlation up (+0.077 at 2 heads,
+0.087 at 8, against +0.017 at 1), but all remain near zero and none is
significant, so this is not evidence of better physical alignment.

### Does temporal encoding add anything? — marginally

Time2Vec gives +4.01% at p = 0.051 and wins 17 of 24 pairs — the most consistent
of the ablations, sitting right at the significance boundary. It does not change
the attention/travel-time result (+0.013). Worth keeping and worth re-running
with more seeds before claiming it.

---

## W5.7 Verdict

### Against the expectation recorded in advance

The advance expectation said: *"Attention is unlikely to produce a large
accuracy gain... The contribution is expected to appear in (a) interpretability
and (b) per-rollout-step error at long horizons. If accuracy gains are modest
but the interpretability result is strong, that is the expected outcome and the
thesis stands on it."*

**The outcome is the mirror image of that prediction.**

| prediction | outcome |
|---|---|
| Accuracy gain modest | **Correct** — +7.8%, real and significant, but not a step change |
| Interpretability strong (attention recovers travel time) | **WRONG** — r = +0.017, sign consistent in 3/8 basins, does not beat a reach-length confound |
| Advantage grows with lead time | **Half right** — grows to +9.7% at t+7 h, then falls back to +5.4% at t+12 h |
| MLP collapses at ungauged nodes | **Correct** |
| Persistence worse still | **Correct** |

The thesis was expected to stand on interpretability if accuracy was modest.
**It cannot, as things stand.** Accuracy is the part that worked.

### Does attention beat GCN?

**Yes.** +7.79% on ungauged discharge RMSE pooled over 8 basins (paired *t*,
p = 0.038), better in 8/8 basins on basin means and 17/24 individual
(basin, seed) pairs (p = 1.3e-03), with a better validation loss on every seed.
The held-out-only estimate is larger (+8.86%) but underpowered at 3 seeds
(p = 0.159).

### Does attention recover travel time above chance?

**No.** Hop-stratified within-node r = **+0.017** against a permutation null,
sign-consistent in only 3 of 8 basins. Four basins reach p < 0.05 but in *both
directions*. It does not beat the reach-length confound (+0.438), and the
result is stable across all three message-passing layers, so it is not an
artefact of which layer is read. Against the required references — 0.698
(routing edges) and 0.769 (all message edges) — it is nowhere close.

**What attention learned instead is clear and consistent:** upstream **flow
magnitude**. Correlation with upstream local area is **+0.870**, with upstream
mean discharge +0.845, with drainage area +0.844 — all sign-consistent in 8/8
basins and significant in 8/8. That is very likely *why* the GAT beats the
GCN's degree-normalised uniform aggregation, and it is a coherent mechanistic
account of both results at once. It is hydrologically sensible. It is not the
claim the project was built on.

### What this means for the project

The honest position is that Week 5 delivered a **working, statistically
supported accuracy contribution and a failed interpretability contribution**.
Three things follow, and they should be decided before Week 6 proceeds:

1. **The attention-vs-travel-time framing needs to change or be dropped.**
   Attention weights track contribution, not lag. One salvage worth testing:
   travel time governs *when* an upstream node matters, so the temporal
   attention axis — not the spatial one — is where lag should appear.
   Attention does vary across rollout steps (per-edge range 0.04–0.35), so the
   signal is not dead; it was simply never tested against travel time
   step-by-step. That is a contained experiment and the natural next step.
2. **The undirected result is a bigger effect than the headline contribution**
   and challenges a standing design constraint. It needs explaining before the
   architecture is fixed.
3. **Edge features and multi-head attention are not earning their place.**
   Both can be dropped with no measurable cost, which simplifies whatever is
   built next.

### Acceptance criteria

| # | criterion | status |
|---|---|---|
| 1 | Dataset regenerated: masked gauges, localised storms, aligned horizon, 8+ basins; mass balance and DAG pass | **Met** — 1.0000 mass balance, DAG pass, 233 nodes / 651 edges |
| 2 | Information test re-run at ungauged nodes, gate stated explicitly | **Met** — PASS, +0.181 / +0.242, exception documented |
| 3 | Baselines re-run, gauged and ungauged reported separately | **Met** |
| 4 | GAT trains, attention extracts, per-step results for 4 models × 3 seeds | **Met** |
| 5 | All four ablations run | **Met** — six runs (3 head counts + directed, edge, Time2Vec) |
| 6 | Attention correlation as `within_node_r` with permutation null and p-value, against both references | **Met** — reported hop-stratified, because plain `within_node_r` is confounded on this graph (see W5.5) |
| 7 | RESULTS.md states plainly whether attention beats GCN and whether it recovers travel time | **Met** — yes, and no |

### Runs behind these numbers

| run | what |
|---|---|
| `20260830-192452-1440f965dd-main` | headline: persistence, MLP, GCN, GAT × 3 seeds |
| `20260831-192438-*-abl_heads2/4/8` | attention capacity |
| `20260831-192438-*-abl_undirected` | directed vs undirected |
| `20260831-192438-*-abl_noedge` | `edge_dim=2` vs none |
| `20260831-192438-*-abl_time2vec` | spatial only vs + Time2Vec |

Reproduce:

```bash
.venv/Scripts/python.exe evaluation/gate_information_test.py
```

```bash
.venv/Scripts/python.exe training/train.py --config configs/week5.yaml
```

```bash
.venv/Scripts/python.exe evaluation/attention_report.py results/20260830-192452-1440f965dd-main/
```

```bash
.venv/Scripts/python.exe evaluation/collect_ablations.py
```

---

# Week 4 — Baselines and Evaluation Harness (preserved)

**Headline: the GCN does not reliably beat the graph-blind MLP, and it does not
beat it at all where it matters — on the held-out basin.**

Across the frozen 3-seed run and a supplementary 8-seed robustness run, the GCN
wins on exactly one of three basins. On the other training basin there is no
difference. On the **held-out basin the MLP is better**, by 25% (3 seeds) and
15% (8 seeds), with the GCN also two to four times more variable across seeds.
Whatever the graph contributes in-distribution does not transfer.

This is the outcome the Week 4 brief named as the one that would change the
project, so the investigation into *why* is below, and it should be read before
any Week 5 work starts.

Everything here comes from seeded, config-logged runs. Headline numbers are
from run `20260830-145849-092b9d652a`, config hash `092b9d652a`,
`configs/week4.yaml`, seeds 0/1/2.

---

## 1. Verdict on each acceptance criterion

| # | Criterion | Status |
|---|---|---|
| 1 | In-degree 3–4 on most nodes, mass balance, DAG assertions | Met, with one correction to the wording — see §2 |
| 2 | Persistence, MLP, GCN train and predict on all three basins | Met |
| 3 | Per-step RMSE/MAE CSV, all models, both splits, 3 seeds | Met — `results/<run>/metrics.csv` |
| 4 | Plot of error vs rollout step | Met — `error_vs_step_discharge_m3s.png` |
| 5 | `attention_eval.py` passes unit tests on synthetic inputs | Met — 20/20 |
| 6 | Config frozen and committed, results traceable | Met |
| 7 | RESULTS.md states plainly whether GCN beats the MLP | This document: **it does not, except on one training basin** |

---

## 2. Task 1 — graph topology

The chain graph gave 12 of 13 nodes per basin exactly one upstream neighbour,
so a softmax over incoming edges was forced to 1.0 and attention had nothing to
learn. Adding 2- and 3-hop upstream edges fixes that:

| | chain graph | with k-hop edges |
|---|---|---|
| edges per basin | 12 | 33 (12 routing + 21 message-only) |
| mean in-degree | 0.92 | 2.54 |
| **nodes with ≥2 incoming edges** | **1 / 13** | **9 / 13** |

In-degree histogram, identical in all three basins:
`{0: 2, 1: 2, 2: 2, 3: 4, 4: 1, 5: 1, 6: 1}`.

**One correction to the brief.** The target of "in-degree 3–4 for most nodes"
is not reachable and should not be chased. Four nodes per basin are headwaters
(`main_00`, `trib_00`) or their immediate successors (`main_01`, `trib_01`).
They have fewer than three ancestors *in existence*; no topology change can
invent any. The 9/13 figure is the meaningful one, because it counts the nodes
where a softmax is actually free to vary.

**Regeneration was verified to be a pure superset of the Week 3 dataset:**

- `nodes.csv` and `timeseries.csv` byte-identical
- all 36 one-hop edges bit-identical (RNG draw order deliberately preserved)
- naive cross-correlation still **r = +0.520** on routing edges
- mass balance unchanged to six decimals

**Second correction to the brief.** Mass balance is 0.9997 / 0.9996 / 0.9993,
not exactly 1.000 — it only *displays* as 1.000/1.000/0.999 at three decimals.
This is unchanged from Week 3 and is not a regression: it is water still in
transit when the simulation ends.

Multi-hop edges are message-passing only. Water is routed through 1-hop edges
exclusively, flagged by the new `is_routing_edge` column, and `muskingum_X` is
`NaN` on multi-hop rows so that any accidental attempt to route through one
fails loudly instead of silently double-counting water. Monotonicity holds: 75
(multi-hop, 1-hop) pairs into a shared target checked, 0 violations.

---

## 3. Results

Mean RMSE across the 12-hour horizon, discharge (m³/s), mean over 3 seeds:

| basin | persistence | MLP | GCN | GCN vs MLP |
|---|---|---|---|---|
| basin_01 (train) | 6.770 | **3.693** | 3.805 | −3.0% |
| basin_02 (train) | 11.405 | 5.093 | **4.998** | +1.9% |
| basin_03 (**held out**) | 5.139 | **2.819** | 3.518 | **−24.8%** |

Skill against persistence (higher is better):

| basin | MLP | GCN |
|---|---|---|
| basin_01 | +48.1% | +46.1% |
| basin_02 | +55.4% | +55.7% |
| basin_03 (held out) | **+42.4%** | +28.5% |

Both learned models comfortably beat persistence everywhere, so the harness and
the training loop work. The problem is specifically that message passing adds
nothing.

**Per-seed spread** (mean RMSE over horizon, discharge) — this is why the
training-basin gaps must be read as noise:

| basin | model | seed 0 | seed 1 | seed 2 | mean ± std |
|---|---|---|---|---|---|
| basin_01 | GCN | 3.285 | 4.019 | 4.111 | 3.805 ± 0.453 |
| basin_01 | MLP | 3.535 | 3.583 | 3.962 | 3.693 ± 0.234 |
| basin_02 | GCN | 5.075 | 5.186 | 4.734 | 4.998 ± 0.235 |
| basin_02 | MLP | 5.390 | 4.917 | 4.973 | 5.093 ± 0.258 |
| basin_03 | GCN | 4.789 | 3.028 | 2.736 | 3.518 ± 1.111 |
| basin_03 | MLP | 3.057 | 2.502 | 2.896 | 2.819 ± 0.286 |

On the training basins the two models' seed ranges overlap completely. On the
held-out basin the GCN is both worse and **four times more variable**
(±1.111 vs ±0.286) — it does not transfer *reliably*, which is worse than
simply not transferring well.

### Robustness: 8 seeds

Three seeds is too few to call a winner, so the central claim was re-run with
8 seeds (`configs/week4_8seed_robustness.yaml`, a separate file — the frozen
config was not touched). Welch's t-test, unequal variance, because the two
models' seed spreads genuinely differ:

| basin | GCN | MLP | GCN vs MLP | Welch *t* | *p* | verdict |
|---|---|---|---|---|---|---|
| basin_01 (train) | 3.700 ± 0.420 | 3.600 ± 0.183 | −2.8% | +0.62 | 0.550 | no difference |
| basin_02 (train) | 4.727 ± 0.302 | 5.320 ± 0.637 | **+11.2%** | −2.38 | **0.039** | GCN better |
| basin_03 (**held out**) | 3.344 ± 0.649 | 2.896 ± 0.408 | −15.5% | +1.65 | 0.124 | no difference |

This is the fairest statement of the result:

- The GCN beats the MLP on **one basin out of three**, marginally (*p* = 0.039).
- On the other training basin there is **no difference**.
- On the **held-out basin the GCN is worse** by 15%. That gap does not reach
  significance at 8 seeds (*p* = 0.124), but it is consistent in direction and
  magnitude with the 3-seed run (−24.8%), and the GCN is the more variable
  model in both.

So the graph is not useless — it helps on basin_02 — but the benefit is
inconsistent between basins and does not survive transfer to an unseen basin.
For a project whose contribution is *improving* graph message passing, a base
message-passing model that only sometimes beats no-graph-at-all is a weak
foundation.

Reproduce with:

```bash
.venv/Scripts/python.exe evaluation/compare_models.py results/20260830-150156-cd34e687df-robustness/
```

Both models converged: every run early-stopped between epochs 13 and 29 of a
40-epoch budget, and best validation losses are effectively identical
(MLP 0.0663–0.0827, GCN 0.0656–0.0774). Nothing here is undertrained.

---

## 4. Why the GCN does not beat the MLP

Two separate causes were found. The first was a bug in my code and is fixed.
The second is a property of the data and is not fixable by modelling.

### 4a. A real bug: static features were never normalised (fixed)

The first full run produced a far worse result — GCN was **−182%** against the
MLP on the held-out basin and *worse than persistence*:

| basin | persistence | MLP | GCN |
|---|---|---|---|
| basin_01 | 6.770 | 4.158 | 3.813 |
| basin_02 | 11.405 | 4.339 | 3.471 |
| basin_03 (held out) | 5.139 | 2.189 | **6.183** |

Cause: `x_static` was passed to the models raw. Only the dynamic features and
targets went through the normaliser. The static attributes differ enormously
between basins:

| feature | train (b01+b02) | held-out (b03) | ratio |
|---|---|---|---|
| elevation_m | 449.65 | 115.19 | 0.26× |
| channel_slope | 0.0075 | 0.0016 | 0.21× |
| drainage_area_km2 | 54.31 | 101.22 | 1.86× |

A node-local MLP absorbs a constant shift into its first layer. A GCN
aggregates those shifted values over up to six neighbours, and the error then
compounds through 12 autoregressive steps. Fixing it (z-score on training-basin
nodes only, recorded in `configs/week4.yaml` under `normalisation.static_stats`)
moved held-out GCN RMSE from 6.183 to 3.518 — now better than persistence.

**This is why the MLP baseline earns its place.** Without a graph-blind control
that was unaffected by the bug, a GCN scoring worse than persistence on the
held-out basin looks like "GNNs don't generalise across basins" rather than
"you forgot to normalise six columns."

### 4b. The real cause: upstream history carries almost no extra information

Even after the fix, the GCN does not beat the MLP. To separate "the GNN is
misconfigured" from "the information isn't there", I ran a model-free test
(`evaluation/graph_information_test.py`): for every interior node, ordinary
least squares predicting discharge at lead *k* from the node's own 24-step
history, versus the same plus its 1-hop upstream neighbours' histories,
scored out-of-sample.

Mean R² gain from adding upstream history:

| lead | own-history R² (range) | mean gain from upstream |
|---|---|---|
| 1 h | 0.9998 – 1.0000 | **+0.0001** |
| 6 h | 0.9459 – 0.9961 | +0.0045 |
| 12 h | 0.5393 – 0.9635 | −0.0144 |

At 1 hour ahead a node's own history explains essentially **all** of its future
discharge (R² = 0.9998). There is no residual for a neighbour to explain. Even
at 12 hours, where own-history R² falls as low as 0.54, adding every upstream
node's full history moves mean R² by roughly one percentage point, and
inconsistently — 24 of 33 nodes gain more than 0.01, but the mean is dragged
negative by a few nodes where the extra collinear regressors hurt out of sample.

Least squares was used deliberately: it has no capacity to squander. If a
linear model given exactly the information a GNN receives cannot extract a
gain, the gain is not there.

**Why the data is like this.** In the generator, each node's discharge is
upstream routed flow *plus local lateral inflow*, and the storms driving that
lateral inflow are spatially correlated across the basin. A node's own recent
discharge therefore already encodes the storm that its upstream neighbours are
responding to. Routing adds a lag of 1.2–4.6 hours per reach, which at hourly
resolution is largely recoverable from the node's own 24-step history.

### 4c. The GCN's one win is probably not coming from the graph

Breaking the information test down per basin contradicts the idea that the GCN
wins on basin_02 *because* it uses upstream information:

| basin | mean R² gain, k=6 | mean R² gain, k=12 | GCN vs MLP (8 seeds) |
|---|---|---|---|
| basin_01 | +0.0095 | −0.0413 | −2.8% (no difference) |
| basin_02 | **+0.0003** | −0.0187 | **+11.2% (GCN wins)** |
| basin_03 | **+0.0168** | **+0.0168** | −15.5% (MLP better) |

The ordering is backwards. basin_02 has the *least* upstream information
available and is the only basin the GCN wins; basin_03 has the *most* and is
where the GCN loses.

A more likely explanation is variance reduction rather than information gain.
On basin_02 the MLP is the least stable model of the whole experiment
(±0.637 across 8 seeds, the largest spread in the table), and the GCN is
noticeably steadier there (±0.302). Averaging over neighbours smooths
predictions, and on the basin where the graph-blind model is noisiest that
smoothing shows up as a win. That is a regularisation effect, obtainable from
dropout or weight decay, and it is **not** the mechanism the thesis is about.

This matters for Week 5: if the GCN's only win comes from smoothing rather than
from routing information, then attention — which changes *how* neighbours are
weighted, not whether smoothing happens — has even less to improve on than the
headline numbers suggest.

### What this means for Week 5

The premise of the contribution — that a better weighting of upstream messages
improves the forecast — is not currently supported by this dataset. Attention
reweights messages that message passing already carries. §4b says those
messages carry very little. **A GAT is likely to land where the GCN did.**

My recommendation is to resolve this before building the GAT. Options, in what
I judge to be descending order of value:

1. **Make routing dominate lateral inflow.** Reduce spatial correlation between
   storms, or shift the runoff balance so that a node's discharge is mostly
   water that arrived from upstream. This makes the graph load-bearing and is a
   generator change, not a model change.
2. **Lengthen the horizon relative to travel time.** With 1.2–4.6 h per reach
   and a 12 h rollout, a node barely sees beyond its immediate neighbours.
   A 48–72 h rollout would force genuine multi-hop propagation.
3. **Change the task to one the graph is necessary for** — e.g. predict at
   ungauged nodes whose own history is withheld. Then own-history is
   unavailable by construction and upstream is the only signal.
4. Proceed to the GAT anyway and report the negative result honestly. Defensible
   as a thesis finding, but it is a much weaker contribution and should be a
   deliberate choice, not a default.

Option 3 is worth noting because it costs nothing to test and it is the
scenario in which the attention-vs-travel-time check is most meaningful.

---

## 5. Physics loss

`L = 1.0 · L_data + 0.05 · L_continuity`, frozen in `configs/week4.yaml`.

Both terms are printed every epoch and are of comparable magnitude before
weighting — at convergence, data ≈ 0.040 and continuity ≈ 0.067 — so neither
dominates the other.

**Correction to the brief.** The brief states the continuity residual is
exactly satisfiable and that "a large residual indicates a bug". Measured on
ground-truth data *before* the loss was written, that is not the case:

| | measured on ground truth |
|---|---|
| headwater nodes | residual **exactly 0.000000** |
| interior nodes | ≈ **3.3%** of mean discharge |
| storage term contribution | halves the residual (0.49 → 0.23 m³/s, basin_01) |

The residual has a non-zero floor of about 3% of mean discharge. The cause is
structural: the generator stores water *distributed along each reach*, as
Muskingum prism **and wedge** storage, whereas a node-based residual lumps
storage at the node as `S = W·L·h`. The wedge component depends on
`muskingum_X`, which is deliberately **not** used here — putting `X` or `K` in
the training objective would let a Week 5 attention head correlate with travel
time for entirely trivial reasons.

Trained models reach a residual of 0.64–0.92 m³/s against a ground-truth floor
of ≈ 0.22 m³/s, i.e. 3–4× the floor. The physics term is acting as a
regulariser, not being over-satisfied. `lambda_physics` is kept modest for this
reason, and the floor is recorded in the config as
`continuity_floor_fraction: 0.033` so a future reader does not mistake a
non-zero continuity term for a bug.

---

## 6. Evaluation harness

`evaluation/metrics.py` emits one tidy row per
(model, basin, split, seed, rollout_step, variable) with RMSE and MAE in
physical units, never aggregated over the horizon. `aggregate_seeds` collapses
seeds to mean ± std; `skill_vs_baseline` computes percentage RMSE reduction;
`plot_error_vs_step` draws error growth with one line per model and a shaded
seed band, one panel per basin.

`evaluation/attention_eval.py` is written and tested although **nothing
produces attention weights yet**. 20/20 unit tests pass against synthetic
inputs: perfect correlation when fed true travel times, exactly zero for
uniform weights, near-zero for noise, −1.0 for anti-correlated input, and
normalised entropy of 1.0 for uniform and 0.0 for one-hot.

Two findings from writing those tests that will matter in Week 5:

- **The raw correlation can be badly misleading.** Attention that is uniform
  *within each node* — carrying zero learned signal — scores a raw Pearson of
  **−0.46** against travel time, purely from in-degree structure, because
  softmax weights are coupled to 1 per node. `within_node_pearson` correctly
  reports 0.00 for the same input. Report the within-node figure.
- **The 0.52 threshold is within noise at this sample size.** Across 200 random
  attention draws on basin_01's 33 edges, mean |r| was 0.14 but the **maximum
  reached 0.51** — essentially the reference, by chance alone. Any Week 5 claim
  of beating r = 0.52 must pool edges across basins and quote a null
  distribution, not report a single number.

There are also **two** valid references, and picking the flattering one silently
would be cheating. Both are exposed as constants:

- `NAIVE_CROSSCORR_R_ROUTING = 0.52` — the 36 one-hop routing edges
- `NAIVE_CROSSCORR_R_ALL_EDGES = 0.81` — all 99 message-passing edges

Attention scored on the full edge set must be compared against 0.81. Multi-hop
edges have larger travel times *and* weaker coupling, which correlation picks up
for free.

---

## 7. Decisions, and things that did not work

- **Zero-initialised output heads.** With random init, the delta
  parameterisation compounded over 12 autoregressive steps into an epoch-1 loss
  of ~3700 for the GCN, and most of the epoch budget went on climbing back to
  persistence. Zeroing the final layer makes every model *start* as exact
  persistence. It also means the MLP and GCN start from an identical
  prediction, so divergence between them is caused by message passing rather
  than initialisation luck.
- **Delta parameterisation** (predict change from last observation, not level)
  for both MLP and GCN. Without it both models spend capacity relearning
  persistence and collapse to the same score for the wrong reason.
- **Forcing is held constant during rollout.** `FloodWindows` supplies
  precipitation and lateral inflow for the input steps only. Holding the last
  observed value is pessimistic — a real forecast system would have a rainfall
  forecast — but it is applied identically to all three models, and it lives in
  `models/base.py` so no model can quietly opt out of it.
- **`forcing_future` is supervision, never input.** The continuity residual at a
  node is not expressible without local lateral inflow, so the future forcing is
  supplied to the *loss*. It is never passed to a model.
- **Splits are contiguous time blocks, and straddling windows are dropped.**
  Windows span 36 steps at stride 6, so shuffling them would put near-duplicates
  on both sides of the split and inflate every score.
- **Metrics are reported on the test time block for *every* basin**, including
  the training basins. Otherwise the train-vs-held-out gap would confound
  "different basin" with "different time range".
- **The MLP and GCN see identical features**, assembled by one shared function
  (`models/base.flatten_node_features`), so any difference between them is
  attributable to the graph alone.
- **Did not work: reading the brief's mass-balance and continuity claims at face
  value.** Both needed correcting against measurement (§2, §5). Both are
  documented rather than silently worked around.

---

## 8. Reproducing

```bash
.venv/Scripts/python.exe data/generate_flood_dataset.py
```

```bash
.venv/Scripts/python.exe training/train.py --config configs/week4.yaml
```

```bash
.venv/Scripts/python.exe evaluation/test_attention_eval.py
```

```bash
.venv/Scripts/python.exe evaluation/graph_information_test.py
```

```bash
.venv/Scripts/python.exe evaluation/compare_models.py results/20260830-145849-092b9d652a/
```

Each training run writes `results/<timestamp>-<config-hash>/` containing
`config.yaml`, `run.json` (config hash, seeds, environment, per-epoch loss
histories), `metrics.csv`, `metrics_per_seed.csv`,
`skill_vs_persistence.csv` and both plots. Every number in this document
traces to run `20260830-145849-092b9d652a`.

Environment: Python 3.11.9, torch 2.13.0+cpu, torch_geometric 2.8.0, CPU only.
A full 3-seed × 3-model run takes about 3 minutes.

**Reproducibility check.** The frozen config was re-run after all code changes
were complete (`...-repro`) and reproduced the headline table to four decimal
places — 3.8050 / 3.6934 / 6.7696 on basin_01, and identically on the other two
basins. Seeding covers torch, numpy and the batch-ordering RNG.

### Run index

| run | what it is |
|---|---|
| `20260830-145523-ab0732f4e2` | first full run, **before** the static-normalisation fix. Kept as the evidence for §4a. Do not quote its numbers as results. |
| `20260830-145849-092b9d652a` | **headline run**, frozen config, 3 seeds. Every number in §3 and §5. |
| `20260830-150156-cd34e687df-robustness` | supplementary 8-seed run, §3 "Robustness". |
| `...-repro` | reproducibility check of the headline run after the final code changes. |
