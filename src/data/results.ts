// GENERATED FILE — DO NOT HAND-EDIT.
// Written by scripts/generate_data.py from the committed inputs in provenance/
// (MANIFEST.json sha256 5173382e799dd4a5). Reproduce with: npm run regen-data
// Any manual change here is overwritten, and CI fails if this file drifts.

/** verified: measured and reproducible from provenance/. qualified: measured, with a
 *  limitation stated in `qualifier`. pending: not measured. */
export type Status = 'verified' | 'qualified' | 'pending'

/** recomputed from raw run outputs, or read from a source document (RESULTS.md). */
export type Derivation = 'recomputed' | 'read'

export type Interval = {
  lo: number
  hi: number
  level: number
  method: string
}

export type Metric = {
  id: string
  label: string
  value: number | string
  unit?: string
  status: Status
  /** the limitation, rendered next to the number; present iff status is 'qualified' */
  qualifier?: string
  note?: string
  group: string
  derivation: Derivation
  source?: string
  /** run ID, or script and dataset version for model-free tests */
  run?: string
  configHash?: string
  interval?: Interval
  /** the analysis this value replaced, kept so the change is visible */
  supersedes?: string
}

export type ModelKey = 'persistence' | 'mlp' | 'gcn' | 'gat'

export type RolloutSeries = {
  model: ModelKey
  status: 'verified' | 'pending'
  values: number[]
}

export type Rollout = {
  variable: string
  unit: string
  steps: number[]
  run: string
  configHash: string | null
  panels: { gauged: RolloutSeries[]; ungauged: RolloutSeries[] }
} | null

export type BasinComparison = {
  basin: string
  split: string
  persistence: number | null
  mlp: number | null
  gcn: number
  gcnSd: number
  gat: number
  gatSd: number
  gatVsGcnPct: number
  /** lowest and highest per-seed GAT-vs-GCN change in this basin */
  seedRangePct: [number, number]
}[] | null

export type AttentionByBasin = { basin: string; r: number; p: number }[] | null

export type Ablation = {
  name: string
  detail: string
  run: string
  configHash: string | null
  rmse: number
  rmseHeld: number
  vsRefPct: number | null
  interval: Interval | null
  betterIn: string | null
  attnR: number
}

export type WayanadSeries = RolloutSeries & { mae: number[]; lo: number[]; hi: number[] }

export type WayanadRollout = {
  variable: string
  unit: string
  steps: number[]
  run: string
  configHash: string | null
  events: string[]
  panels: { gauged: WayanadSeries[]; ungauged: WayanadSeries[] }
} | null

export type WayanadInfo = {
  runId: string
  configHash: string | null
  runDate: string
  archive: string
  archiveSha256: string
  model: string
  events: { train: string[]; test: string[] }
  heroEvent: string
} | null

export type Provenance = {
  thesisCommit: string | null
  datasetVersion: string | null
  runs: { id: string; role: string; configHash: string | null; configPath: string | null; seeds: number[] | null }[]
  bootstrap: { draws: number; seed: number; level: number; unit: string }
  wayanad: WayanadInfo
}

export const provenance: Provenance = {
  "thesisCommit": "7e4f7bcd143d7f1e9c88eaf03dd23796ea8be753",
  "datasetVersion": "864b79098c",
  "runs": [
    {
      "id": "20260830-192452-1440f965dd-main",
      "role": "main",
      "configHash": "1440f965dd",
      "configPath": "configs/week5.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-4e2a31e0b3-abl_time2vec",
      "role": "ablation",
      "configHash": "4e2a31e0b3",
      "configPath": "configs/week5_abl_time2vec.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-52c5547b20-abl_heads4",
      "role": "ablation",
      "configHash": "52c5547b20",
      "configPath": "configs/week5_abl_heads4.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-72dd64c403-abl_noedge",
      "role": "ablation",
      "configHash": "72dd64c403",
      "configPath": "configs/week5_abl_noedge.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-b9b97f5d57-abl_undirected",
      "role": "ablation",
      "configHash": "b9b97f5d57",
      "configPath": "configs/week5_abl_undirected.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-d7e2f0bbe2-abl_heads8",
      "role": "ablation",
      "configHash": "d7e2f0bbe2",
      "configPath": "configs/week5_abl_heads8.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260831-192438-fb58ec3500-abl_heads2",
      "role": "ablation",
      "configHash": "fb58ec3500",
      "configPath": "configs/week5_abl_heads2.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260830-145849-092b9d652a",
      "role": "week4",
      "configHash": "092b9d652a",
      "configPath": "configs/week4.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20260830-150156-cd34e687df-robustness",
      "role": "week4",
      "configHash": "cd34e687df",
      "configPath": "configs/week4_8seed_robustness.yaml",
      "seeds": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ]
    },
    {
      "id": "20260830-150740-092b9d652a-repro",
      "role": "week4",
      "configHash": "092b9d652a",
      "configPath": "configs/week4.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    },
    {
      "id": "20261022-094841-88294fdea4-wayanad",
      "role": "wayanad",
      "configHash": "88294fdea4",
      "configPath": "configs/wayanad.yaml",
      "seeds": [
        0,
        1,
        2
      ]
    }
  ],
  "bootstrap": {
    "draws": 10000,
    "seed": 20260830,
    "level": 0.95,
    "unit": "basins and seeds resampled independently"
  },
  "wayanad": {
    "runId": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "runDate": "2026-10-22",
    "archive": "HEC-RAS-2D-FINAL-DATASET.zip",
    "archiveSha256": "7511a29510d13e416e641bfc45d5f5f0272e83e7d6de981ab791215cb66a37ee",
    "model": "HEC-RAS 7.0.1 2D; T1 = plan p02, the observed 2018 inflow (dataset README)",
    "events": {
      "train": [
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "H7",
        "H8",
        "H9",
        "H10"
      ],
      "test": [
        "T1",
        "T2",
        "T3",
        "T4",
        "T5"
      ]
    },
    "heroEvent": "T1 (plan p02, observed 2018 inflow)"
  }
}

export const metrics: Metric[] = [
  {
    "id": "basins",
    "label": "Basins",
    "value": 8,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "nodes",
    "label": "Cross-section nodes",
    "value": 233,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "edges",
    "label": "Directed edges",
    "value": 651,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "note": "225 routing + 426 message-only (2–3 hops)",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gauged",
    "label": "Gauged nodes",
    "value": 32,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gauged_pct",
    "label": "Share of nodes gauged",
    "value": 13.7,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "unit": "%",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "mean_tt",
    "label": "Mean 1-hop travel time",
    "value": 7.64,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "unit": "h",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "horizon_ratio",
    "label": "Rollout horizon / mean travel time",
    "value": 1.57,
    "status": "verified",
    "group": "dataset",
    "derivation": "recomputed",
    "unit": "×",
    "note": "12-step rollout",
    "source": "provenance/dataset/*.csv",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "real_sections",
    "label": "Real network: surveyed cross-sections",
    "value": 28,
    "status": "verified",
    "group": "real",
    "derivation": "read",
    "note": "H1–H4 network; a property of the river, not a result",
    "source": "provenance/RESULTS.md §W5.1 A1"
  },
  {
    "id": "real_gauges",
    "label": "Real network: gauges",
    "value": 4,
    "status": "verified",
    "group": "real",
    "derivation": "read",
    "note": "H1–H4",
    "source": "provenance/RESULTS.md §W5.1 A1"
  },
  {
    "id": "real_ungauged",
    "label": "Real network: cross-sections without a gauge",
    "value": 86,
    "status": "verified",
    "group": "real",
    "derivation": "read",
    "unit": "%",
    "note": "24 of 28",
    "source": "provenance/RESULTS.md §W5.1 A1"
  },
  {
    "id": "repro",
    "label": "Reproducibility re-run of the Week 4 headline table",
    "value": "identical",
    "status": "verified",
    "group": "rigor",
    "derivation": "read",
    "note": "to four decimal places, after all code changes",
    "source": "provenance/RESULTS.md §Week 4 §8",
    "run": "20260830-150740-092b9d652a-repro",
    "configHash": "092b9d652a"
  },
  {
    "id": "mass_balance",
    "label": "Mass balance, all basins",
    "value": "1.0000",
    "status": "verified",
    "group": "dataset",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.1 A5",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "storm_kernel",
    "label": "Storm kernel width (2-D Gaussian)",
    "value": 0.18,
    "status": "verified",
    "group": "dataset",
    "derivation": "read",
    "note": "over along-flow position and branch offset",
    "source": "provenance/RESULTS.md §W5.1 A2",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "dry_rise",
    "label": "Rising node-hours under dry sky",
    "value": 12.0,
    "status": "verified",
    "group": "dataset",
    "derivation": "read",
    "unit": "%",
    "note": "samples local forcing cannot explain",
    "source": "provenance/RESULTS.md §W5.1 A2",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "w4_own_r2",
    "label": "Own 24-step history, R² at 1 h",
    "value": 0.9998,
    "status": "verified",
    "group": "week4",
    "derivation": "read",
    "note": "least squares, out of sample",
    "source": "provenance/RESULTS.md §Week 4 §4b",
    "run": "evaluation/graph_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "w4_gain_1h",
    "label": "Mean R² gain from upstream history, 1 h",
    "value": "+0.0001",
    "status": "verified",
    "group": "week4",
    "derivation": "read",
    "source": "provenance/RESULTS.md §Week 4 §4b",
    "run": "evaluation/graph_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "w4_gain_6h",
    "label": "Mean R² gain from upstream history, 6 h",
    "value": "+0.0045",
    "status": "verified",
    "group": "week4",
    "derivation": "read",
    "source": "provenance/RESULTS.md §Week 4 §4b",
    "run": "evaluation/graph_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "w4_gain_12h",
    "label": "Mean R² gain from upstream history, 12 h",
    "value": "−0.0144",
    "status": "verified",
    "group": "week4",
    "derivation": "read",
    "source": "provenance/RESULTS.md §Week 4 §4b",
    "run": "evaluation/graph_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "w4_gcn_variability",
    "label": "GCN seed spread relative to the MLP's, held-out basin",
    "value": "2–4×",
    "status": "verified",
    "group": "week4",
    "derivation": "read",
    "note": "s.d. across seeds",
    "source": "provenance/RESULTS.md §Week 4 §3",
    "run": "20260830-145849-092b9d652a",
    "configHash": "092b9d652a"
  },
  {
    "id": "gate_all",
    "label": "Gate ΔR², all ungauged nodes",
    "value": "+0.181",
    "status": "qualified",
    "group": "gate",
    "derivation": "read",
    "qualifier": "below the pass mark in basin_08; positive in 7 of 8 basins",
    "note": "pass mark 0.05; model-free ridge test",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_served",
    "label": "Gate ΔR², ungauged nodes with a gauged ancestor",
    "value": "+0.242",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "note": "positive in 8 of 8 basins",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_k1",
    "label": "Gate ΔR² at lead 1 h",
    "value": "+0.236",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_k6",
    "label": "Gate ΔR² at lead 6 h",
    "value": "+0.241",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_k12",
    "label": "Gate ΔR² at lead 12 h",
    "value": "+0.247",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_b08",
    "label": "basin_08, all ungauged nodes",
    "value": "−0.005",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "note": "10 of 26 ungauged nodes have no gauged ancestor",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_b08_served",
    "label": "basin_08, served nodes only",
    "value": "+0.012",
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "gate_coverage",
    "label": "Ungauged nodes with a gauged ancestor in 9 hops",
    "value": 63,
    "status": "verified",
    "group": "gate",
    "derivation": "read",
    "unit": "%",
    "note": "126 of 201",
    "source": "provenance/RESULTS.md §W5.2",
    "run": "evaluation/gate_information_test.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "trap_untrained",
    "label": "Plain within-node r, untrained GATv2",
    "value": 0.956,
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "the false headline the metric would have produced",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "evaluation/test_attention_eval.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "trap_confound",
    "label": "Within-node r(reach length, travel time)",
    "value": "+0.97 to +0.99",
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "hop count drives both",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "flood_routing_dataset@864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "ref_routing",
    "label": "Naive cross-correlation reference, routing edges",
    "value": 0.698,
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "re-derived on the Week 5 dataset; also in the run's config.yaml",
    "source": "provenance/RESULTS.md §W5.1 A5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "ref_all",
    "label": "Naive cross-correlation reference, all message edges",
    "value": 0.769,
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.1 A5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_local_area",
    "label": "Attention vs upstream local area",
    "value": "+0.870",
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "sign-consistent in 8 of 8 basins",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_mean_q",
    "label": "Attention vs upstream mean discharge",
    "value": "+0.845",
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "significant in 8 of 8",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_drainage",
    "label": "Attention vs upstream drainage area",
    "value": "+0.844",
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "significant in 8 of 8",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_reach",
    "label": "Attention vs reach length",
    "value": "+0.062",
    "status": "verified",
    "group": "attention",
    "derivation": "read",
    "note": "5 of 8 basins",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "tests_passing",
    "label": "Passing tests on the attention evaluator",
    "value": 33,
    "status": "verified",
    "group": "rigor",
    "derivation": "read",
    "source": "provenance/RESULTS.md §W5.5",
    "run": "evaluation/test_attention_eval.py on dataset 864b79098c",
    "configHash": "864b79098c"
  },
  {
    "id": "undir_coverage_r",
    "label": "Undirected gain vs upstream gauge coverage, r",
    "value": "−0.06",
    "status": "verified",
    "group": "ablation",
    "derivation": "read",
    "note": "the obvious mechanism fails",
    "source": "provenance/RESULTS.md §W5.6",
    "run": "20260831-192438-b9b97f5d57-abl_undirected",
    "configHash": "b9b97f5d57"
  },
  {
    "id": "w4_gcn_win",
    "label": "GCN over MLP, the one basin it won",
    "value": "+11.1",
    "status": "qualified",
    "group": "week4",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "one basin of three; 8 seeds; 95% interval +3.7% to +19.2%",
    "note": "basin_02; positive = GCN better",
    "source": "provenance/runs/20260830-150156-cd34e687df-robustness/metrics_per_seed.csv",
    "run": "20260830-150156-cd34e687df-robustness",
    "configHash": "cd34e687df",
    "interval": {
      "lo": 3.739,
      "hi": 19.175,
      "level": 0.95,
      "method": "bootstrap over 8 seeds per model, 10000 draws; percentile"
    }
  },
  {
    "id": "w4_gcn_held",
    "label": "GCN vs MLP, held-out basin",
    "value": "-15.5",
    "status": "qualified",
    "group": "week4",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "8 seeds; interval spans zero; 95% interval −35.6% to +0.2%",
    "note": "basin_03; positive = GCN better",
    "source": "provenance/runs/20260830-150156-cd34e687df-robustness/metrics_per_seed.csv",
    "run": "20260830-150156-cd34e687df-robustness",
    "configHash": "cd34e687df",
    "interval": {
      "lo": -35.614,
      "hi": 0.248,
      "level": 0.95,
      "method": "bootstrap over 8 seeds per model, 10000 draws; percentile"
    }
  },
  {
    "id": "gat_vs_gcn_held",
    "label": "GAT over GCN, held-out basins only",
    "value": "+8.86",
    "status": "qualified",
    "group": "heldout",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval −2.9% to +17.2%; 2 basins, 3 seeds; interval spans zero",
    "note": "basin_07, basin_08 were never trained on",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": -2.903,
      "hi": 17.209,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 2 basins and 3 seeds with replacement; percentile"
    },
    "supersedes": "paired t over 3 seed means, p = 0.159"
  },
  {
    "id": "gat_rmse_held",
    "label": "GAT ungauged RMSE, held-out basins",
    "value": 3.505,
    "status": "verified",
    "group": "heldout",
    "derivation": "recomputed",
    "unit": "m³/s",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "gcn_rmse_held",
    "label": "GCN ungauged RMSE, held-out basins",
    "value": 3.846,
    "status": "verified",
    "group": "heldout",
    "derivation": "recomputed",
    "unit": "m³/s",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "gat_vs_gcn",
    "label": "GAT over GCN, ungauged discharge RMSE",
    "value": "+7.79",
    "status": "qualified",
    "group": "model",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval +2.5% to +13.6%, 3 seeds × 8 basins; held-out basins alone +8.86%, interval spans zero",
    "note": "pooled over all 8 basins, including the 2 held out; positive = GAT better",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": 2.529,
      "hi": 13.624,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "supersedes": "paired t over 3 seed means, p = 0.038. Replaced: the clustered interval excludes zero, so the direction holds"
  },
  {
    "id": "gat_rmse",
    "label": "GAT ungauged RMSE, 8-basin mean",
    "value": 3.566,
    "status": "verified",
    "group": "model",
    "derivation": "recomputed",
    "unit": "m³/s",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "gcn_rmse",
    "label": "GCN ungauged RMSE, 8-basin mean",
    "value": 3.867,
    "status": "verified",
    "group": "model",
    "derivation": "recomputed",
    "unit": "m³/s",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "gat_pair_wins",
    "label": "Basin–seed pairs where GAT beats GCN",
    "value": "17 / 24",
    "status": "qualified",
    "group": "model",
    "derivation": "recomputed",
    "qualifier": "pairs share basins and seeds, so this is not 24 independent wins",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "supersedes": "one-sample t over 24 pairs as if independent, p = 1.3e-03"
  },
  {
    "id": "gat_basins_won",
    "label": "Basins where GAT's 3-seed mean beats GCN's",
    "value": "8 / 8",
    "status": "verified",
    "group": "model",
    "derivation": "recomputed",
    "note": "by up to 18% in some basins and under 1% in others",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "gat_vs_mlp",
    "label": "GAT over graph-blind MLP, ungauged",
    "value": "+41.0",
    "status": "verified",
    "group": "model",
    "derivation": "recomputed",
    "unit": "%",
    "note": "95% interval +24.2% to +57.9%",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/metrics_per_seed.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": 24.161,
      "hi": 57.854,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "att_tt_r",
    "label": "Attention vs travel time, hop-stratified r",
    "value": "+0.017",
    "status": "qualified",
    "group": "attention",
    "derivation": "recomputed",
    "qualifier": "chance level, 95% interval −0.324 to +0.379; reach-length baseline scores +0.438; seeds agree at +0.386",
    "note": "all message edges; permutation null, 1000 draws",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": -0.324,
      "hi": 0.379,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "att_tt_r_routing",
    "label": "Attention vs travel time, routing edges",
    "value": "-0.129",
    "status": "qualified",
    "group": "attention",
    "derivation": "recomputed",
    "qualifier": "wrong sign, chance level, 95% interval −0.557 to +0.320; reach-length baseline scores +0.438; seeds agree at +0.386",
    "note": "one-hop routing edges only",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": -0.557,
      "hi": 0.32,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "att_confound",
    "label": "Reach-length confound baseline",
    "value": "+0.438",
    "status": "verified",
    "group": "attention",
    "derivation": "recomputed",
    "note": "95% interval +0.017 to +0.800",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": 0.017,
      "hi": 0.8,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "att_vs_confound",
    "label": "Attention minus the reach-length baseline",
    "value": "-0.421",
    "status": "verified",
    "group": "attention",
    "derivation": "recomputed",
    "note": "95% interval −0.823 to −0.067",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": -0.823,
      "hi": -0.067,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "att_entropy",
    "label": "Mean normalised attention entropy",
    "value": 0.875,
    "status": "verified",
    "group": "attention",
    "derivation": "recomputed",
    "note": "1.0 = uniform over incoming edges",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_sign",
    "label": "Basins where attention r is positive",
    "value": "3 / 8",
    "status": "verified",
    "group": "attention",
    "derivation": "recomputed",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_scores.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd"
  },
  {
    "id": "att_seed_r",
    "label": "Attention agreement between seeds",
    "value": "+0.386",
    "status": "qualified",
    "group": "attention",
    "derivation": "recomputed",
    "qualifier": "patterns not stable across seeds; 95% interval +0.294 to +0.483",
    "source": "provenance/runs/20260830-192452-1440f965dd-main/attention_seed_consistency.csv",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "interval": {
      "lo": 0.294,
      "hi": 0.483,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins with replacement; percentile"
    }
  },
  {
    "id": "undirected_gain",
    "label": "Undirected graph vs directed reference",
    "value": "+11.1",
    "status": "qualified",
    "group": "ablation",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval −4.2% to +25.5%; better in only 14/24 pairs; mechanism unexplained",
    "note": "mean per-pair relative change, as in RESULTS.md",
    "source": "provenance/runs/20260831-192438-b9b97f5d57-abl_undirected/metrics_per_seed.csv",
    "run": "20260831-192438-b9b97f5d57-abl_undirected",
    "configHash": "b9b97f5d57",
    "interval": {
      "lo": -4.155,
      "hi": 25.507,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "supersedes": "one-sample t over 24 pairs as if independent, p = 0.012"
  },
  {
    "id": "wy_reach_km",
    "label": "Wayanad: modelled reach along its centreline",
    "value": 30.0,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "unit": "km",
    "qualifier": "centreline traced through cell positions recovered from rasters; the static files were not delivered",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_cells_located",
    "label": "Wayanad: cells located by their own raster pixels",
    "value": 93.7,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "unit": "%",
    "qualifier": "1602 of 25268 cells placed by similarity instead",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_sections",
    "label": "Wayanad: cross-sections extracted",
    "value": 7,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "qualifier": "spacing set so every reach takes at least one hourly step; the brief asked for 25 to 40; 4 gauged, 3 ungauged",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_travel_h",
    "label": "Wayanad: measured flood travel time over the reach",
    "value": 10.92,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "unit": "h",
    "qualifier": "mean of cross-correlation (11.51 h) and peak arrival (9.55 h), which disagree by 0.44 h per reach on average",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_celerity",
    "label": "Wayanad: implied flood-wave celerity per reach",
    "value": "0.50–1.53",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "unit": "m/s",
    "qualifier": "within the brief's 0.5 to 4 m/s sanity range after merging reaches in a floodplain storage zone",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_tt_length_r",
    "label": "Wayanad: travel time vs reach length, r",
    "value": "+0.855",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "qualifier": "correlated but not perfectly; six reaches",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_outflow_check",
    "label": "Wayanad: outlet discharge vs the model's outflow record, worst event",
    "value": 3.3,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "unit": "%",
    "qualifier": "relative RMSE; an independent check of the volume-based discharge",
    "source": "provenance/wayanad/checks.json",
    "run": "data/extract_wayanad.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_gate_r2_6h",
    "label": "Wayanad: ungauged discharge 6 h ahead from upstream gauges, R²",
    "value": 0.9,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "read",
    "qualifier": "median over 15 events, ridge regression, out of sample; range 0.36 to 0.91; the test's baseline has no varying input here, so its ΔR² is not meaningful",
    "source": "provenance/wayanad/gate.txt",
    "run": "evaluation/gate_information_test.py on archive 7511a29510",
    "configHash": "7511a29510"
  },
  {
    "id": "wy_gat_vs_gcn",
    "label": "Wayanad: GAT over GCN, ungauged discharge RMSE, held-out events",
    "value": "+11.4",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval −16.7% to +40.7%; 5 held-out events, 3 seeds, 3 ungauged sections; first run on model output; T5 goes the other way (-4.4%)",
    "note": "scored over each held-out event's whole record; positive = GAT better",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/metrics_per_seed.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "interval": {
      "lo": -16.723,
      "hi": 40.725,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 5 events and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "wy_gat_vs_gcn_train",
    "label": "Wayanad: GAT over GCN, training events' final 20%",
    "value": "-8.9",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval −47.5% to +44.4%; recession only (the harness's test block); not the comparison that matters",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/metrics_per_seed.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "interval": {
      "lo": -47.54,
      "hi": 44.439,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 10 events and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "wy_gat_vs_mlp",
    "label": "Wayanad: GAT over graph-blind MLP, held-out events",
    "value": "+91.6",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "unit": "%",
    "qualifier": "95% interval +88.1% to +94.6%; the MLP has no upstream information at an ungauged section",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/metrics_per_seed.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "interval": {
      "lo": 88.086,
      "hi": 94.626,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 5 events and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "wy_gat_rmse",
    "label": "Wayanad: GAT ungauged discharge RMSE, held-out events",
    "value": 60.7,
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "unit": "m³/s",
    "qualifier": "5 held-out events, 3 seeds, 3 ungauged sections; first run on model output",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/metrics_per_seed.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4"
  },
  {
    "id": "wy_att_tt_r",
    "label": "Wayanad: attention vs measured travel time, stratified r",
    "value": "-0.363",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "qualifier": "inside the permutation null, whose 95th percentile is +0.586 with only 15 edges per event; reach-length baseline scores +0.929; seeds agree at +0.606; the bootstrap 95% interval −0.445 to −0.285 is narrow only because every event shares one graph and one measured answer key",
    "note": "held-out events; strata = hop count × target in-degree (chain adaptation)",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/attention_scores_wayanad.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "interval": {
      "lo": -0.445,
      "hi": -0.285,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 5 events and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "wy_att_confound",
    "label": "Wayanad: reach-length confound baseline",
    "value": "+0.929",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "qualifier": "the same statistic with reach length, a legal model input, in place of attention",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/attention_scores_wayanad.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4"
  },
  {
    "id": "wy_att_vs_confound",
    "label": "Wayanad: attention minus the reach-length baseline",
    "value": "-1.292",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "qualifier": "95% interval −1.373 to −1.213",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/attention_scores_wayanad.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4",
    "interval": {
      "lo": -1.373,
      "hi": -1.213,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 5 events and 3 seeds with replacement; percentile"
    }
  },
  {
    "id": "wy_att_seed_r",
    "label": "Wayanad: attention agreement between seeds",
    "value": "+0.606",
    "status": "qualified",
    "group": "wayanad",
    "derivation": "recomputed",
    "qualifier": "held-out events; patterns only moderately stable",
    "source": "provenance/runs/20261022-094841-88294fdea4-wayanad/attention_seed_consistency_wayanad.csv",
    "run": "20261022-094841-88294fdea4-wayanad",
    "configHash": "88294fdea4"
  },
  {
    "id": "wy_validation",
    "label": "Wayanad: model output checked against observed gauges or satellite extent",
    "value": "—",
    "status": "pending",
    "group": "wayanad",
    "derivation": "recomputed",
    "note": "the supplier's README: not yet validated against observations"
  },
  {
    "id": "real_gat_rmse",
    "label": "GAT ungauged RMSE on H1–H4 gauge data",
    "value": "—",
    "status": "pending",
    "group": "real",
    "derivation": "recomputed",
    "unit": "m³/s",
    "note": "Real network: 4 gauges, 28 cross-sections. Not yet run."
  },
  {
    "id": "real_gat_vs_gcn",
    "label": "GAT vs GCN on H1–H4 gauge data",
    "value": "—",
    "status": "pending",
    "group": "real",
    "derivation": "recomputed",
    "unit": "%",
    "note": "Synthetic results do not transfer automatically."
  },
  {
    "id": "temporal_att_tt",
    "label": "Temporal attention vs travel time, step by step",
    "value": "—",
    "status": "pending",
    "group": "real",
    "derivation": "recomputed",
    "unit": "r",
    "note": "Next experiment: lag may appear on the temporal axis, not the spatial one."
  },
  {
    "id": "undir_mechanism",
    "label": "Why the undirected graph helps",
    "value": "—",
    "status": "pending",
    "group": "real",
    "derivation": "recomputed",
    "note": "Effect measured; mechanism unconfirmed."
  }
]

export const rollout: Rollout = {
  "variable": "discharge_m3s",
  "unit": "m³/s",
  "steps": [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12
  ],
  "run": "20260830-192452-1440f965dd-main",
  "configHash": "1440f965dd",
  "panels": {
    "gauged": [
      {
        "model": "persistence",
        "status": "verified",
        "values": [
          0.3578,
          0.7126,
          1.0629,
          1.4087,
          1.7509,
          2.0895,
          2.4233,
          2.7507,
          3.0704,
          3.3825,
          3.688,
          3.9873
        ]
      },
      {
        "model": "mlp",
        "status": "verified",
        "values": [
          0.7001,
          0.9691,
          1.2207,
          1.4737,
          1.7347,
          1.9982,
          2.2688,
          2.5411,
          2.8138,
          3.0874,
          3.3608,
          3.639
        ]
      },
      {
        "model": "gcn",
        "status": "verified",
        "values": [
          2.4023,
          2.5091,
          2.7091,
          2.8123,
          2.8654,
          2.9642,
          3.0841,
          3.1964,
          3.3289,
          3.4971,
          3.6858,
          3.9043
        ]
      },
      {
        "model": "gat",
        "status": "verified",
        "values": [
          1.2325,
          1.5615,
          1.8225,
          2.0269,
          2.1921,
          2.3493,
          2.5138,
          2.6796,
          2.8404,
          3.0223,
          3.204,
          3.4151
        ]
      }
    ],
    "ungauged": [
      {
        "model": "persistence",
        "status": "verified",
        "values": [
          13.7874,
          13.7734,
          13.7596,
          13.7462,
          13.7333,
          13.7207,
          13.7084,
          13.6964,
          13.6848,
          13.6735,
          13.6629,
          13.6528
        ]
      },
      {
        "model": "mlp",
        "status": "verified",
        "values": [
          6.1689,
          6.0771,
          6.039,
          6.0233,
          6.021,
          6.0184,
          6.0208,
          6.0204,
          6.0214,
          6.0257,
          6.0308,
          6.0566
        ]
      },
      {
        "model": "gcn",
        "status": "verified",
        "values": [
          4.5785,
          4.247,
          4.0579,
          3.9742,
          3.9,
          3.8471,
          3.7802,
          3.696,
          3.6346,
          3.5935,
          3.5564,
          3.5416
        ]
      },
      {
        "model": "gat",
        "status": "verified",
        "values": [
          4.2377,
          3.938,
          3.7713,
          3.666,
          3.5878,
          3.4865,
          3.4151,
          3.368,
          3.3284,
          3.3198,
          3.3253,
          3.3497
        ]
      }
    ]
  }
}

export const basinComparison: BasinComparison = [
  {
    "basin": "basin_01",
    "split": "train_basin",
    "persistence": 8.603,
    "mlp": 2.992,
    "gcn": 1.095,
    "gcnSd": 0.105,
    "gat": 1.091,
    "gatSd": 0.096,
    "gatVsGcnPct": 0.3,
    "seedRangePct": [
      -14.47,
      16.28
    ]
  },
  {
    "basin": "basin_02",
    "split": "train_basin",
    "persistence": 10.999,
    "mlp": 4.862,
    "gcn": 3.674,
    "gcnSd": 0.369,
    "gat": 3.67,
    "gatSd": 0.06,
    "gatVsGcnPct": 0.11,
    "seedRangePct": [
      -10.84,
      11.48
    ]
  },
  {
    "basin": "basin_03",
    "split": "train_basin",
    "persistence": 15.828,
    "mlp": 7.745,
    "gcn": 5.083,
    "gcnSd": 0.046,
    "gat": 4.541,
    "gatSd": 0.061,
    "gatVsGcnPct": 10.66,
    "seedRangePct": [
      9.33,
      12.83
    ]
  },
  {
    "basin": "basin_04",
    "split": "train_basin",
    "persistence": 12.274,
    "mlp": 8.357,
    "gcn": 2.758,
    "gcnSd": 0.118,
    "gat": 2.254,
    "gatSd": 0.089,
    "gatVsGcnPct": 18.28,
    "seedRangePct": [
      10.47,
      23.52
    ]
  },
  {
    "basin": "basin_05",
    "split": "train_basin",
    "persistence": 11.322,
    "mlp": 4.422,
    "gcn": 2.245,
    "gcnSd": 0.11,
    "gat": 1.856,
    "gatSd": 0.041,
    "gatVsGcnPct": 17.34,
    "seedRangePct": [
      14.22,
      19.84
    ]
  },
  {
    "basin": "basin_06",
    "split": "train_basin",
    "persistence": 26.671,
    "mlp": 9.088,
    "gcn": 8.392,
    "gcnSd": 0.38,
    "gat": 8.107,
    "gatSd": 0.114,
    "gatVsGcnPct": 3.4,
    "seedRangePct": [
      -1.24,
      8.84
    ]
  },
  {
    "basin": "basin_07",
    "split": "held_out",
    "persistence": 10.618,
    "mlp": 6.113,
    "gcn": 3.249,
    "gcnSd": 0.148,
    "gat": 2.914,
    "gatSd": 0.204,
    "gatVsGcnPct": 10.33,
    "seedRangePct": [
      -1.24,
      19.53
    ]
  },
  {
    "basin": "basin_08",
    "split": "held_out",
    "persistence": 13.417,
    "mlp": 4.768,
    "gcn": 4.442,
    "gcnSd": 0.42,
    "gat": 4.096,
    "gatSd": 0.294,
    "gatVsGcnPct": 7.79,
    "seedRangePct": [
      -8.05,
      22.26
    ]
  }
]

export const attentionByBasin: AttentionByBasin = [
  {
    "basin": "basin_01",
    "r": 0.733,
    "p": 0.002
  },
  {
    "basin": "basin_02",
    "r": -0.181,
    "p": 0.594
  },
  {
    "basin": "basin_03",
    "r": 0.417,
    "p": 0.049
  },
  {
    "basin": "basin_04",
    "r": -0.605,
    "p": 0.101
  },
  {
    "basin": "basin_05",
    "r": -0.108,
    "p": 0.615
  },
  {
    "basin": "basin_06",
    "r": 0.714,
    "p": 0.002
  },
  {
    "basin": "basin_07",
    "r": -0.67,
    "p": 0.009
  },
  {
    "basin": "basin_08",
    "r": -0.162,
    "p": 0.501
  }
]

export const ablations: Ablation[] | null = [
  {
    "name": "reference (B1)",
    "detail": "heads=1 edge_dim=2 t2v=False undir=False",
    "run": "20260830-192452-1440f965dd-main",
    "configHash": "1440f965dd",
    "rmse": 3.566,
    "rmseHeld": 3.505,
    "vsRefPct": null,
    "interval": null,
    "betterIn": null,
    "attnR": 0.017
  },
  {
    "name": "time2vec",
    "detail": "heads=1 edge_dim=2 t2v=True undir=False",
    "run": "20260831-192438-4e2a31e0b3-abl_time2vec",
    "configHash": "4e2a31e0b3",
    "rmse": 3.491,
    "rmseHeld": 3.353,
    "vsRefPct": 4.01,
    "interval": {
      "lo": -0.95,
      "hi": 10.464,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "17/24",
    "attnR": 0.013
  },
  {
    "name": "heads4",
    "detail": "heads=4 edge_dim=2 t2v=False undir=False",
    "run": "20260831-192438-52c5547b20-abl_heads4",
    "configHash": "52c5547b20",
    "rmse": 3.591,
    "rmseHeld": 3.339,
    "vsRefPct": -3.32,
    "interval": {
      "lo": -16.266,
      "hi": 6.317,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "9/24",
    "attnR": 0.058
  },
  {
    "name": "noedge",
    "detail": "heads=1 edge_dim=0 t2v=False undir=False",
    "run": "20260831-192438-72dd64c403-abl_noedge",
    "configHash": "72dd64c403",
    "rmse": 3.52,
    "rmseHeld": 3.338,
    "vsRefPct": 2.1,
    "interval": {
      "lo": -3.169,
      "hi": 8.646,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "15/24",
    "attnR": 0.013
  },
  {
    "name": "undirected",
    "detail": "heads=1 edge_dim=2 t2v=False undir=True",
    "run": "20260831-192438-b9b97f5d57-abl_undirected",
    "configHash": "b9b97f5d57",
    "rmse": 2.931,
    "rmseHeld": 3.051,
    "vsRefPct": 11.13,
    "interval": {
      "lo": -4.155,
      "hi": 25.507,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "14/24",
    "attnR": 0.025
  },
  {
    "name": "heads8",
    "detail": "heads=8 edge_dim=2 t2v=False undir=False",
    "run": "20260831-192438-d7e2f0bbe2-abl_heads8",
    "configHash": "d7e2f0bbe2",
    "rmse": 3.549,
    "rmseHeld": 3.403,
    "vsRefPct": 0.01,
    "interval": {
      "lo": -7.789,
      "hi": 6.748,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "12/24",
    "attnR": 0.087
  },
  {
    "name": "heads2",
    "detail": "heads=2 edge_dim=2 t2v=False undir=False",
    "run": "20260831-192438-fb58ec3500-abl_heads2",
    "configHash": "fb58ec3500",
    "rmse": 3.512,
    "rmseHeld": 3.348,
    "vsRefPct": 1.5,
    "interval": {
      "lo": -2.678,
      "hi": 6.986,
      "level": 0.95,
      "method": "clustered bootstrap, 10000 draws resampling 8 basins and 3 seeds with replacement; percentile"
    },
    "betterIn": "13/24",
    "attnR": 0.077
  }
]

export const wayanadRollout: WayanadRollout = {
  "variable": "discharge_m3s",
  "unit": "m³/s",
  "steps": [
    1,
    2,
    3,
    4
  ],
  "run": "20261022-094841-88294fdea4-wayanad",
  "configHash": "88294fdea4",
  "events": [
    "T1",
    "T2",
    "T3",
    "T4",
    "T5"
  ],
  "panels": {
    "gauged": [
      {
        "model": "persistence",
        "status": "verified",
        "values": [
          17.555,
          33.333,
          49.443,
          65.188
        ],
        "mae": [
          11.639,
          22.515,
          33.582,
          44.627
        ],
        "lo": [
          13.167,
          24.818,
          36.417,
          47.852
        ],
        "hi": [
          22.189,
          41.943,
          62.132,
          82.215
        ]
      },
      {
        "model": "mlp",
        "status": "verified",
        "values": [
          29.517,
          57.413,
          85.615,
          113.527
        ],
        "mae": [
          23.615,
          46.455,
          69.484,
          92.431
        ],
        "lo": [
          22.013,
          42.7,
          63.722,
          84.481
        ],
        "hi": [
          37.963,
          74.165,
          110.823,
          147.172
        ]
      },
      {
        "model": "gcn",
        "status": "verified",
        "values": [
          56.198,
          53.923,
          69.689,
          87.121
        ],
        "mae": [
          36.835,
          37.143,
          43.617,
          55.594
        ],
        "lo": [
          34.822,
          29.253,
          35.159,
          44.47
        ],
        "hi": [
          80.465,
          78.317,
          112.19,
          138.755
        ]
      },
      {
        "model": "gat",
        "status": "verified",
        "values": [
          29.414,
          34.911,
          47.963,
          60.869
        ],
        "mae": [
          22.639,
          25.006,
          33.551,
          42.104
        ],
        "lo": [
          24.077,
          23.013,
          32.269,
          41.053
        ],
        "hi": [
          33.441,
          48.083,
          71.742,
          91.841
        ]
      }
    ],
    "ungauged": [
      {
        "model": "persistence",
        "status": "verified",
        "values": [
          720.453,
          720.236,
          720.304,
          720.222
        ],
        "mae": [
          576.611,
          576.694,
          576.962,
          577.182
        ],
        "lo": [
          549.447,
          549.308,
          549.315,
          549.196
        ],
        "hi": [
          963.001,
          962.692,
          962.78,
          962.675
        ]
      },
      {
        "model": "mlp",
        "status": "verified",
        "values": [
          719.903,
          723.057,
          726.5,
          730.601
        ],
        "mae": [
          596.367,
          606.965,
          614.697,
          622.146
        ],
        "lo": [
          573.846,
          589.687,
          603.101,
          613.787
        ],
        "hi": [
          933.25,
          922.825,
          916.931,
          912.785
        ]
      },
      {
        "model": "gcn",
        "status": "verified",
        "values": [
          99.054,
          58.324,
          54.364,
          62.162
        ],
        "mae": [
          66.02,
          38.429,
          37.561,
          44.756
        ],
        "lo": [
          52.395,
          32.121,
          31.935,
          40.158
        ],
        "hi": [
          180.001,
          86.579,
          75.271,
          83.628
        ]
      },
      {
        "model": "gat",
        "status": "verified",
        "values": [
          89.104,
          51.47,
          49.854,
          52.353
        ],
        "mae": [
          52.545,
          34.713,
          33.876,
          36.731
        ],
        "lo": [
          38.623,
          30.953,
          29.881,
          33.188
        ],
        "hi": [
          179.794,
          82.524,
          80.274,
          79.685
        ]
      }
    ]
  }
}
