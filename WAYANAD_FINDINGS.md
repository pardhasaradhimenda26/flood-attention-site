# Wayanad findings log

One line per adaptation, assumption or surprise, with the reason. Written as the
work happened (22 Oct 2026), for the 27 October meeting. Dataset:
`HEC-RAS-2D-FINAL-DATASET.zip` (4.91 GB, 15 event archives + README).

## What the archive is

- **Not HEC-RAS project files.** No `.prj`, `.g##`, `.p##.hdf`, `.dss` or terrain rasters: it is a pre-exported HydroGraphNet-format dataset (tab-separated text per cell per hour) produced by MehulKhanna/HEC-RAS-Dataset-Pipeline. Used the exports directly; no HDF parser written. (Brief §2: "check for pre-exported CSVs first".)
- **15 events, not one.** 10 training (H1–H10) and 5 test (T1–T5), all the 2018 Kapila/Kabini inflow hydrograph scaled (×0.5–×1.75), peak-swapped or time-shifted. T1 is the 2018 observed inflow.
- **Model: HEC-RAS 7.0.1 2D, full SWE; mesh 71,447 cells; 25,268 cells in the dataset** (wet in any event). Output hourly, 720 steps, 02–31 Aug 2018. CRS EPSG:32643 (UTM 43N).
- **Boundaries:** one inflow (flow hydrograph, Mananthavady, ~165 m wide), one outflow (normal depth, slope 0.0005).
- **No rainfall** (`M80_Pr` is zero), **no infiltration**, impervious fraction a placeholder. All water enters at the one inflow boundary.
- **"Calibrated" is not supported.** The README states the events "have not yet been checked against gauge or satellite data". The site therefore says *HEC-RAS 2D hydraulic model output, not yet validated against observations* — not "calibrated" and never "real gauge data". (Brief §1 says "calibrated to a real event"; the supplier's own README says otherwise, and the README is the primary source.)
- **No tributary.** One inflow, one channel: the extracted graph is a single chain. The "tributary gauge" of the 4-of-28 framing cannot exist.

## Missing from the delivery

- **The static per-cell files are not in the zip** — `M80_XY` (coordinates), `M80_CE` (bed elevation), `M80_CA` (area), `M80_N`, `M80_CS`, `M80_A`, `M80_CU`, `M80_FA`, plus `train.txt`, `test.txt`, `event_data.csv`, `scenarios.json`, `verify_all.py`. The README says they ship "as one archive for the static files and docs"; that archive was not included. Every event archive was checked.
- **Fallback chosen:** recover each cell's position and bed elevation from the per-event GeoTIFFs (25 m grid, EPSG:32643), which *are* included. Details and verification below. **Ask the Taiwan team for the static archive** — the recovery is checked but it is a reconstruction.

## Cell positions recovered (fallback for the missing static files)

- **Method.** Each event's `max_depth.tif` is the cell values rasterised on a 25 m grid (tested: 99.7% of H1 pixel values equal some cell's maximum depth; valid pixels cover 35.2 km², the README's total cell area). A cell's maximum depth in all 15 events is a 15-number fingerprint; pixels carrying the same fingerprint belong to that cell. Cell position = mean of its pixel centres; area = pixel count × 625 m².
- **Bed elevation** = `max_wse − max_depth` at the cell's wet pixels, from the ten first-geometry-build events only (the README warns 232 cells differ in H5, H6, H9, H10, T4). Recovered range 593.95–641.39 m against the README's 594.0–641.4 m.
- **Result.** 95.0% of valid pixels matched a unique cell; 23,666 of 25,268 cells located by their own pixels; 39 duplicate fingerprints; **1,602 cells (6.3%) have no pixel of their own** (smaller than a 25 m pixel, or a duplicate fingerprint) and were placed at the located cell with the most similar T1 depth history, flagged `located = false` in `cells.csv`. Their volumes still count in every discharge; only their position is approximate.
- **Recovered area 33.4 km²** of 35.2 km²: the 1.8 km² gap is the 1,602 unlocated cells.

## Hydraulic quantities

- **Discharge** at a section = inflow − rate of change of the water volume in every cell upstream of it (`M80_V`, which the supplier verified against HEC-RAS storage to 0.001%). Exact continuity, since there is no rain and no tributary. No face flows were delivered, so the brief's preferred face-flow route was not available.
- **Lateral inflow** is therefore **identically zero** below the first section (the residual of an exact balance), and equals the inflow at the first section. This is physically right for a model with one inflow and no rain, and it means the brief's non-negativity check passes trivially. Recorded rather than presented as a finding.
- **Depth** at a section = thalweg depth: the deepest crossing cell at T1's inflow peak, read every hour.
- **Manning's n** feature: the land-cover file was not delivered, so `manning_n` is a constant 0.035 (no information). Back-calculated n from section-mean velocity, hydraulic radius and water-surface slope is in `checks.json`.
- **Channel width** = wet width across an 80 m band at median flow (after the 48 h warm-up); `flood_width_m` = the same at T1's peak. The first attempt read median flow inside the model's warm-up hours and got zero widths downstream; fixed.
- **Rain** is zero, so `precipitation_mm` is zero everywhere. The training harness divided by its standard deviation; a generic guard now leaves a zero-variance feature unscaled (`training/train.py`, harness only, no model code).

## Centreline, sections and the measured answer key

- **Centreline:** the path of maximum depth through cells deeper than 0.5 m in T1, 6 h after the inflow peak (cost = length / depth³), smoothed over ~300 m and resampled every 25 m. **29.98 km** from the inflow boundary (south-west, near Mananthavady) to the outflow (north-east). No centreline was supplied in a geometry file (none was delivered), so the brief's first preference was unavailable; the second (max-depth path at peak flow) is used.
- **Travel time is measured, never computed.** For every reach and every event: the lag at peak cross-correlation of upstream and downstream discharge (refined below one hour by a parabola, negative lags searched so a sub-hour lag is not clamped to zero), and separately the difference in first-wave peak arrival. Both are stored (`travel_time_xcorr_h`, `travel_time_peak_h`); `travel_time_hours` is their mean, median over the 15 events. Whole reach: 11.5 h by cross-correlation, 9.6 h by peak arrival.
- **The two measures disagree by 0.44 h on average** — mostly in a floodplain storage zone 15–24 km downstream, where storage delays the peak more than it delays the bulk of the hydrograph. They agree within 0.3 h on four of six reaches.
- **Section spacing — the brief's rules conflict here, and the one about the lag won.** Hourly output and a 30 km reach crossed in ~10.5 h allow about ten one-hour reaches at most. Peak-arrival spacing first gave 9–10 sections, but one reach in the storage zone had an implied celerity of 0.26 m/s, failing the 0.5–4 m/s check. Final rule: walk downstream and place the next section at the first point where the **measured** travel time is ≥ 1 h **and** the celerity is 0.5–4 m/s. Result: **7 sections**, not the 25–40 the brief asks for. Every reach takes 1.04–4.86 h; celerity 0.50–1.53 m/s. The storage zone is one 8.75 km reach taking 4.9 h.
- **Gauges: 4 of 7**, at sections 0 (upstream), 2, 4 and 6 (outlet). The brief's 4-of-28 framing cannot survive 7 sections; only 3 sections are ungauged, so "ungauged" results rest on 3 nodes per event. No tributary exists for the fourth gauge, so the two middle gauges are at the thirds.
- **Edges:** 6 routing edges, plus 2- and 3-hop message edges (15 per event). The graph is a chain.

## Verification (brief §3)

- **Mass balance:** discharge is built from continuity, so the balance closes by construction. Independent check: the last section's discharge against the outflow-boundary record, **1.7–3.3% relative RMSE** across the 15 events.
- **Velocity cross-check:** discharge from cell velocities integrated over a 300 m band correlates with the volume-based discharge at **r ≥ 0.999 at every section**. Its magnitude is 0.9–1.24× at six sections and 0.24× at the first (250 m below the 165 m-wide inflow line, where the README warns flow is concentrated). The magnitude rests on cell areas recovered from 25 m pixels, which is why shape and scale are reported separately.
- **Peak attenuates downstream:** T1 2,149 → 1,994 m³/s; H8 3,220 → 3,018 m³/s. ✓
- **Peak broadens downstream:** time above half-peak grows from 58–59 h at the first section to 63–74 h at the outlet, in every event checked. ✓
- **Travel time vs reach length:** r = 0.855. They correlate, but not perfectly. ✓ (On the synthetic basins the within-node confound was 0.97.)
- **Manning consistency: does not hold.** The n implied by section-mean velocity, hydraulic radius and water-surface slope is 0.07–1.41 (median 0.20 at median flow, 0.14 at peak), far above the 0.033–0.16 land-cover range. Reasons: the water-surface slope is ~10⁻⁴, there is backwater from the normal-depth outflow boundary, and the sections are 2D floodplains rather than 1D channels. Uniform-flow Manning does not describe this reach; recorded, not forced.

## Information test (before training)

- Run unchanged (`evaluation/gate_information_test.py --data-dir wayanad_dataset`; the option was added, nothing else changed). Output: `results/wayanad_gate.txt`.
- **The ΔR² it reports is not meaningful here.** Its baseline is each node's static attributes plus its own local forcing (rain, lateral inflow), and on this river both are zero at every ungauged section. The baseline therefore predicts a constant, scores R² ≈ −80 out of sample, and every ΔR² (+136) measures that collapse rather than a gain.
- **What it does show:** with the upstream gauges' history, discharge at the ungauged sections is predicted out of sample at **R² 0.93–0.98 at 1 h, 0.87–0.91 at 6 h and 0.00–0.43 at 12 h in 14 of 15 events**. The exception is H10 (the flood arriving five days early): 0.78, 0.36 and −1.59, because its out-of-sample last 30% is a different regime. Upstream information is clearly usable at short leads; it fades by 12 h, past the ~10.5 h it takes the flood to cross the reach.
- **Rollout horizon: 4 steps** = round(2 × 1.82 h mean measured routing-edge travel time), per brief §4. Input window (24 h), stride, model, loss, λ and seeds are Week 5's, unchanged.

## The experiment

- **Run `20261022-094841-88294fdea4-wayanad`**, config hash `88294fdea4` (`configs/wayanad.yaml`, written by `data/make_wayanad_config.py`). All four models (persistence, graph-blind MLP, GCN, GATv2) on one frozen config: Week 5's model, training, loss weights (λ_data 1.0, λ_physics 0.05) and seeds 0–2, with **no model-code changes**.
- **Events as basins:** every event is its own "basin" on an identical graph, so the loader, models, loss and harness run unchanged. Training: H1–H10. Held out: T1–T5 (the README's split).
- **Harness change (opt-in):** held-out events are scored over their **whole record** (`split.held_out_full_series`). The harness otherwise scores each event's last 20% only (26–31 Aug), which is recession after both 2018 peaks, so scoring there alone would miss every flood. Training events are still scored on their last 20%.
- **Zero-variance guard** for static and edge features too: `manning_n` is now a constant.

## First numbers (qualified at best; brief §7)

All from the run above, intervals from a clustered bootstrap resampling held-out events and seeds (10,000 draws). **Model output, not validated against observations.**

- **GAT over GCN, ungauged discharge RMSE, held-out events: +11.4%, 95% interval −16.7% to +40.7%.** It includes zero, so the gain is not established. Per event: GAT is better on T1–T4 (+13% to +27%) and worse on T5 (−4.4%), the ×1.75 flood that extrapolates beyond every training event.
- On the training events' final 20% (recession only) GCN is better: −8.9%, interval −47.5% to +44.4%. Not the comparison that matters; reported so it is not hidden.
- **Both graph models beat the graph-blind MLP by +91.6%** (88.1% to 94.6%) at the ungauged sections. Without upstream information an ungauged section is essentially unpredictable here; persistence and the MLP both sit near 720 m³/s RMSE.
- **Per-step error** (1–4 h, gauged and ungauged, RMSE and MAE with intervals) is in `results.ts` (`wayanadRollout`) and on the site.
- **Attention vs measured travel time: null again.** Stratified r = −0.363 on the held-out events, inside the permutation null (its 95th percentile is +0.586 with only 15 edges per event). The reach-length confound baseline scores +0.929, so reach length predicts the timings far better than attention. Seeds agree on their attention at +0.606.
  - The bootstrap interval for r (−0.445 to −0.285) is narrow only because every event shares one graph and one answer key. The permutation null is the right test with 15 edges, and the result is inside it.
  - **Metric adaptation:** the Week 5 within-node, hop-stratified metric is undefined on a chain (one incoming edge per hop count per node). Edges are instead compared within strata of hop count × target in-degree, across the chain (`evaluation/wayanad_attention.py`). The confound and the null use the same strata.

## The site (brief §5)

- **Hero:** the Wayanad terrain (bed elevation of the model's own cells on a 50 m grid) with the modelled T1 depth spreading across it, every two hours, interpolated between frames. No shader approximation of flooding remains: where the water is drawn, the model put it.
  - Vertical scale is ×30 for ground and water alike. Ground outside the modelled area is a neutral fill, drawn darker and without contours.
  - Four gauge towers carry live depth and discharge from the extracted series; the three ungauged sections get survey lines with no number.
  - The timeline shows the inflow hydrograph (the model has no rain, so rain drops are gone) and the four gauges' rise. The inflow peak (11 Aug 00:00) and outlet peak (11 Aug 10:00) are marked and the 10 h lag is dimensioned.
- **River-to-graph morph:** now starts from the real place (the T1 maximum-depth map) and ends at the 7-node chain.
- **New Act 4 section, "A real river, modelled: first numbers":** two-layer claims, status figures (attention beside its confound baseline at equal size), the per-step chart with interval bands, and a dated provenance line (run, config hash, archive sha256, plan).
- **Fallback video:** `public/wayanad/inundation_T1.mp4`, the whole month on the 25 m grid with a caption, date and depth scale burned in (1406×1280, 24 fps, 0.9 MB, H.264). It is the hero's no-WebGL fallback and reusable by the Taiwan team.
- **Provenance:** `provenance/wayanad/` holds the extracted `nodes.csv`, `edges.csv` (with both measured travel-time columns), `timeseries.csv`, `basins.csv`, `checks.json`, `arrival.csv`, `centreline.csv` and the information-test log; `provenance/runs/<run>/` holds the run outputs. `MANIFEST.json` records the archive's sha256, the extraction scripts' hashes and the site assets' hashes. `npm run regen-data` rebuilds `results.ts` identically.

## Performance and live verification (22 October 2026)

The Wayanad hero first shipped below the brief's budget (Lighthouse mobile Performance 78–89). Fixes, each verified before it shipped:

- **No image before the WebGL probe.** The hero showed `plan.png` at 30% while the WebGL probe ran. That image could become the page's largest paint and only arrive after the JavaScript. The largest paint is now the hero lede (0.75 s on a 4×-throttled CPU).
- **Scene loads after the first contentful paint.** The scene used to start in the first idle slot. When a run's first frame reached the screen late, three.js was already on the headline's critical path (simulated LCP 4.2 s). It now waits for the `first-contentful-paint` entry, with a 4 s timeout where paint timing is unsupported.
- **Valley built in a worker** (`src/three/valley.worker.ts`, `valleyBuild.ts`). The fill, smoothing, index and normal computation on the 351 × 320 grid was one 1.6 s main-thread task on a throttled phone. The worker also fetches the model output and transfers the buffers. Renders are pixel-identical (maximum per-pixel difference 0 against the previous build).
- **Compact water mesh.** The per-frame depth update looped over and re-uploaded all 112,320 grid vertices. The water now has its own mesh of the 16,291 vertices of quads that are ever wet. Flood-clock time during load fell from 374 ms to 27 ms. Renders are pixel-identical.
- **Every second cell below the high tier.** Phones land on the medium tier, where the full grid is denser than the pixels it covers.
- **Gauge boards on phones.** At 412 px the four boards covered each other and hid G2's discharge. Below 640 px they show name and depth only, and every second board hangs below its tower. The gauge table carries discharge.

**Measurements.** All are Lighthouse 12.2.1, mobile, simulated throttling, from this machine.

| Build | Where | Runs | Performance | LCP | TBT |
|---|---|---|---|---|---|
| Pre-Wayanad (`1832008`) | local `vite preview` | 5, alternating | median 91 (88–94) | 2.33 s | 318 ms |
| Final | local `vite preview` | 5, alternating | median 97 (95–98) | 2.32 s | 48 ms |
| Final | https://flood-attention-site.vercel.app/ | 5 | median 79 (71–83) | 2.28 s | 827 ms |

Accessibility is 100 and CLS 0 in every run.

Under identical local conditions the final build beats the pre-Wayanad build. Live runs from this machine vary widely between identical runs (70–93 across sessions). Most of the variance is in tasks outside the page's code: Lighthouse's own evaluation tasks of up to 310 ms, and unattributable browser work. **The ≥ 85 budget is therefore not confirmed on the live site.** PageSpeed Insights, which runs on Google's servers, could not be used: its daily keyless quota was exhausted. Run it once from https://pagespeed.web.dev/ to settle this.

**Live checks on the final build, both hosts:**
- No console errors or warnings, and no failed requests.
- The hero draws about 60 frames/s on screen, 0 offscreen, and resumes on return (checked with `?debug=frames`).
- At 320 px the page width equals the viewport. Every SVG that extends past it sits inside an `overflow: hidden` container.

## Not done, and why

- **Physical phone test:** not possible from this session. Emulated viewports only. Do it before the 27 October meeting.
- **25–40 sections:** see above. Hourly output plus the one-step rule allow at most ~10, and the celerity check brought it to 7.
- **Static files, face flows, land-cover Manning:** not delivered. Recovered or fallen back as recorded above. Ask the Taiwan team for the static archive.
- **Validation against observations:** pending, as the supplier's README says.
- **Lighthouse ≥ 85 on the live site:** not confirmed from this machine (median 79, above). The same build scores 97 locally, against 91 for the pre-Wayanad build. Check once with PageSpeed Insights.
