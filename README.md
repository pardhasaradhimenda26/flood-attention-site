# Flood wave attention — research site

Interactive showcase for the B.Tech thesis *Temporal Graph Attention Networks for
Physics-Consistent Flood Wave Propagation Across River Cross-Section Networks*
(Pardhasaradhi Menda, SRM Institute of Science and Technology).

Static SPA: Vite + React 18 + TypeScript, @react-three/fiber + drei + three,
framer-motion (DOM only), zustand, d3-scale/d3-shape (hand-rolled SVG charts),
Tailwind with tokens in `tailwind.config.ts` and colour in `src/styles/tokens.css`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/, works from any static host or sub-path
npm run preview
```

## Where the numbers come from

Every measured number lives in `src/data/results.ts`; the river geometry, travel
times, attention weights and storm records in `src/data/network.ts`. **Both are
generated — do not hand-edit them.** Regenerate from the thesis repository:

```bash
python scripts/generate_data.py                      # default: ../Machine Learning Project
python scripts/generate_data.py "D:/path/to/repo"    # explicit path
python scripts/generate_data.py --basin basin_03     # network shown in the 3D scenes
```

The script is standard-library Python (no numpy; it reads `attention.npz` with a
small built-in `.npy` reader) and reads:

| source | becomes |
|---|---|
| `flood_routing_dataset/nodes.csv`, `edges.csv`, `basins.csv` | nodes, edges, `travelTimeHours`, gauged flags, basin table |
| `flood_routing_dataset/timeseries.csv` | the two-gauge storm hydrograph and the 36-hour model window |
| `results/<run>-main/metrics*.csv` | rollout curves, per-basin table, GAT vs GCN (paired t computed in the script) |
| `results/<run>-main/attention.npz` | learned weights: last layer, 12 rollout steps, mean and range over seeds |
| `results/<run>-main/attention_scores.csv`, `attention_seed_consistency.csv` | attention statistics |
| `results/ablations.csv` + each ablation's `metrics_per_seed.csv` | ablation table (RESULTS.md convention: mean per-pair relative change, one-sample t) |
| `RESULTS.md` | only to confirm recorded constants (gate test, Week 4 test, untrained-model check) still appear there |

**Status rule.** A metric is `verified` only when the file it comes from exists and
holds the rows it needs. A missing run, a model missing from a run, or a recorded
constant no longer present in RESULTS.md makes it `pending`; the site hatches it
and says "pending". Real-gauge (H1–H4) results stay pending until they exist.
When the real run lands, re-run the script — nothing else needs editing.

**Without the thesis repo** the script generates the network from the seeded spec
in the site brief (§6.1) and fills results only from numbers the brief itself
lists (§8), with GAT-vs-GCN and everything else pending. The site builds and
renders completely in either mode.

Per-reach wave dispersion is not approximated: the script ports the dataset
generator's Muskingum routing (with its sub-reach splitting) and measures each
reach's impulse-response variance numerically. The hero's pulse lag is the sum
of `travelTimeHours` along the path — edit one value in `network.ts` and the
arrival times on the page move.

## Testing switches

| URL parameter | effect |
|---|---|
| `?webgl=0` | force the SVG fallback for every scene |
| `?tier=low` / `medium` / `high` | override device-tier detection |
| `?motion=reduce` | force the reduced-motion path |

## Structure

```
scripts/generate_data.py   thesis outputs → src/data/{network,results}.ts
src/data/content.ts        all prose
src/lib/                   graph + wave arrival maths, terrain, stations, metrics
src/three/                 RiverScene, AttentionScene, CrossSection, primitives, tiering
src/components/            SVG charts, tables, stage ruler, contour field, plan-view fallback
src/sections/              page sections; everything below the hero is a lazy chunk
```
