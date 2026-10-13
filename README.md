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

Every number on the page lives in `src/data/results.ts`; the river geometry,
travel times, attention weights and storm records in `src/data/network.ts`.
**Both are generated — do not hand-edit them.**

```bash
npm run regen-data      # rebuild results.ts from the committed inputs in provenance/
npm run check-data      # the same, then fail if results.ts changed (CI runs this)
python scripts/generate_data.py "D:/path/to/thesis-repo"   # re-sync from the thesis repo
```

`provenance/` holds the inputs behind `results.ts`, copied from the thesis
repository: `RESULTS.md`, the dataset's node, edge and basin tables, and for each
run its `run.json`, `config.yaml` and metric CSVs. `provenance/MANIFEST.json`
records the thesis commit, every run ID and config hash, the dataset version (a
hash over all four dataset tables, including the 54 MB `timeseries.csv`, which is
not committed) and a SHA-256 for every file. `regen-data` refuses to run if any
file differs from the manifest, and its output is byte-for-byte reproducible.

`network.ts` needs `timeseries.csv` and `attention.npz`, so it is only rebuilt by
a full sync from the thesis repo.

### Evidential status

Every metric carries one of three statuses, shown on the page by the rule under
the figure and in words, never by colour alone:

| status | meaning | on the page |
|---|---|---|
| `verified` | measured, reproducible from `provenance/` | solid rule, "Verified" |
| `qualified` | measured, with a stated limitation | dashed rule, the qualifier beside the number |
| `pending` | not yet measured | hatched field, "pending" |

Each metric also records its `derivation` (`recomputed` from run outputs, or
`read` from `RESULTS.md`), its `source` file, and the `run` and `configHash`
behind it. Comparisons carry a 95% interval from a clustered bootstrap that
resamples basins and seeds independently (10,000 draws, fixed seed), because
basin–seed pairs that share a basin or a seed are not independent. Where that
replaced a t-test, the old result is kept in `supersedes`.

## Tests

```bash
npm test     # data contract, chart and wave maths, status rendering,
             # WebGL fallback, provenance hashes, production build smoke test
npm run lint
```

CI (`.github/workflows/deploy.yml`) runs lint, tests, build and `check-data` on
every push; GitHub Pages deploys from `main` only after they pass, and Vercel's
build command runs lint and tests before building.

## Testing switches

| URL parameter | effect |
|---|---|
| `?webgl=0` | force the SVG fallback for every scene |
| `?tier=low` / `medium` / `high` | override device-tier detection |
| `?motion=reduce` | force the reduced-motion path |

## Structure

```
scripts/generate_data.py   thesis outputs → provenance/ → src/data/{network,results}.ts
provenance/                committed inputs and MANIFEST.json behind results.ts
src/data/content.ts        all prose
src/lib/                   graph + wave arrival maths, terrain, stations, metrics
src/three/                 RiverScene, AttentionScene, CrossSection, primitives, tiering
src/components/            SVG charts, tables, stage ruler, contour field, plan-view fallback
src/sections/              page sections; everything below the hero is a lazy chunk
```
