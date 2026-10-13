// GENERATED FILE — DO NOT HAND-EDIT.
// Written by scripts/generate_data.py on 2026-10-07 14:49.
// Mode: thesis-repo. Source: C:/Machine Learning Project
// Re-run the script to update. Any manual change here is overwritten.

export type Metric = {
  id: string
  label: string
  value: number | string
  unit?: string
  status: 'verified' | 'pending'
  note?: string
  group: string
  source?: string
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
  panels: { gauged: RolloutSeries[]; ungauged: RolloutSeries[] }
} | null

export type BasinComparison = {
  basin: string
  split: string
  persistence: number
  mlp: number
  gcn: number
  gcnSd: number
  gat: number
  gatSd: number
  gatVsGcnPct: number
}[] | null

export type AttentionByBasin = { basin: string; r: number; p: number }[] | null

export type Ablation = {
  name: string
  detail: string
  rmse: number
  vsRefPct: number | null
  p: number | null
  betterIn: string | null
  attnR: number
}

export const provenance: { mode: string; runs: string[] } = {
  "mode": "thesis-repo",
  "runs": [
    "20260830-192452-1440f965dd-main",
    "ablations.csv"
  ]
}

export const metrics: Metric[] = [
  {
    "id": "basins",
    "label": "Basins",
    "value": 8,
    "status": "verified",
    "group": "dataset",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "nodes",
    "label": "Cross-section nodes",
    "value": 233,
    "status": "verified",
    "group": "dataset",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "edges",
    "label": "Directed edges",
    "value": 651,
    "status": "verified",
    "group": "dataset",
    "note": "225 routing + 426 message-only (2–3 hops)",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "gauged",
    "label": "Gauged nodes",
    "value": 32,
    "status": "verified",
    "group": "dataset",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "gauged_pct",
    "label": "Share of nodes gauged",
    "value": 13.7,
    "status": "verified",
    "group": "dataset",
    "unit": "%",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "mean_tt",
    "label": "Mean 1-hop travel time",
    "value": 7.64,
    "status": "verified",
    "group": "dataset",
    "unit": "h",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "horizon_ratio",
    "label": "Rollout horizon / mean travel time",
    "value": 1.57,
    "status": "verified",
    "group": "dataset",
    "unit": "×",
    "note": "12-step rollout",
    "source": "flood_routing_dataset/*.csv"
  },
  {
    "id": "real_sections",
    "label": "Real network: surveyed cross-sections",
    "value": 28,
    "status": "verified",
    "group": "real",
    "note": "H1–H4 network",
    "source": "RESULTS.md §W5.1 A1"
  },
  {
    "id": "real_gauges",
    "label": "Real network: gauges",
    "value": 4,
    "status": "verified",
    "group": "real",
    "note": "H1–H4",
    "source": "RESULTS.md §W5.1 A1"
  },
  {
    "id": "real_ungauged",
    "label": "Real network: cross-sections without a gauge",
    "value": 86,
    "status": "verified",
    "group": "real",
    "unit": "%",
    "note": "24 of 28",
    "source": "RESULTS.md §W5.1 A1"
  },
  {
    "id": "repro",
    "label": "Reproducibility re-run of a headline table",
    "value": "identical",
    "status": "verified",
    "group": "rigor",
    "note": "metrics.csv byte-identical to the original run",
    "source": "RESULTS.md §Week 4 §8"
  },
  {
    "id": "mass_balance",
    "label": "Mass balance, all basins",
    "value": "1.0000",
    "status": "verified",
    "group": "dataset",
    "source": "RESULTS.md §W5.1 A5"
  },
  {
    "id": "storm_kernel",
    "label": "Storm kernel width (2-D Gaussian)",
    "value": 0.18,
    "status": "verified",
    "group": "dataset",
    "note": "over along-flow position and branch offset",
    "source": "RESULTS.md §W5.1 A2"
  },
  {
    "id": "dry_rise",
    "label": "Rising node-hours under dry sky",
    "value": 12.0,
    "status": "verified",
    "group": "dataset",
    "unit": "%",
    "note": "samples local forcing cannot explain",
    "source": "RESULTS.md §W5.1 A2"
  },
  {
    "id": "w4_own_r2",
    "label": "Own 24-step history, R² at 1 h",
    "value": 0.9998,
    "status": "verified",
    "group": "week4",
    "source": "RESULTS.md §Week 4 §4b"
  },
  {
    "id": "w4_gain_1h",
    "label": "Mean R² gain from upstream history, 1 h",
    "value": "+0.0001",
    "status": "verified",
    "group": "week4",
    "source": "RESULTS.md §Week 4 §4b"
  },
  {
    "id": "w4_gain_6h",
    "label": "Mean R² gain from upstream history, 6 h",
    "value": "+0.005",
    "status": "verified",
    "group": "week4",
    "note": "reported +0.0045",
    "source": "RESULTS.md §Week 4 §4b"
  },
  {
    "id": "w4_gain_12h",
    "label": "Mean R² gain from upstream history, 12 h",
    "value": "−0.014",
    "status": "verified",
    "group": "week4",
    "source": "RESULTS.md §Week 4 §4b"
  },
  {
    "id": "w4_gcn_win",
    "label": "GCN over MLP, the one basin it won",
    "value": "+11.2",
    "status": "verified",
    "group": "week4",
    "unit": "%",
    "note": "basin_02, p = 0.039; one basin of three",
    "source": "RESULTS.md §Week 4 §3"
  },
  {
    "id": "w4_gcn_held",
    "label": "GCN vs MLP, held-out basin",
    "value": "−15",
    "status": "verified",
    "group": "week4",
    "unit": "%",
    "note": "GCN 2–4× more variable across seeds",
    "source": "RESULTS.md §Week 4 §3"
  },
  {
    "id": "gate_all",
    "label": "Gate ΔR², all ungauged nodes",
    "value": "+0.181",
    "status": "verified",
    "group": "gate",
    "note": "threshold 0.05; 7 of 8 basins",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_served",
    "label": "Gate ΔR², ungauged nodes with a gauged ancestor",
    "value": "+0.242",
    "status": "verified",
    "group": "gate",
    "note": "8 of 8 basins",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_k1",
    "label": "Gate ΔR² at lead 1 h",
    "value": "+0.236",
    "status": "verified",
    "group": "gate",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_k6",
    "label": "Gate ΔR² at lead 6 h",
    "value": "+0.241",
    "status": "verified",
    "group": "gate",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_k12",
    "label": "Gate ΔR² at lead 12 h",
    "value": "+0.247",
    "status": "verified",
    "group": "gate",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_b08",
    "label": "basin_08, all ungauged nodes",
    "value": "−0.005",
    "status": "verified",
    "group": "gate",
    "note": "10 of 26 ungauged nodes have no gauged ancestor",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_b08_served",
    "label": "basin_08, served nodes only",
    "value": "+0.012",
    "status": "verified",
    "group": "gate",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "gate_coverage",
    "label": "Ungauged nodes with a gauged ancestor in 9 hops",
    "value": 63,
    "status": "verified",
    "group": "gate",
    "unit": "%",
    "note": "126 of 201",
    "source": "RESULTS.md §W5.2"
  },
  {
    "id": "trap_untrained",
    "label": "Plain within-node r, untrained GATv2",
    "value": 0.956,
    "status": "verified",
    "group": "attention",
    "note": "the false headline the metric would have produced",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "trap_confound",
    "label": "within-node r(reach length, travel time)",
    "value": "+0.97 to +0.99",
    "status": "verified",
    "group": "attention",
    "note": "hop count drives both",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "ref_routing",
    "label": "Naive cross-correlation reference, routing edges",
    "value": 0.698,
    "status": "verified",
    "group": "attention",
    "note": "re-derived on the Week 5 dataset",
    "source": "RESULTS.md §W5.1 A5"
  },
  {
    "id": "ref_all",
    "label": "Naive cross-correlation reference, all message edges",
    "value": 0.769,
    "status": "verified",
    "group": "attention",
    "source": "RESULTS.md §W5.1 A5"
  },
  {
    "id": "att_local_area",
    "label": "Attention vs upstream local area",
    "value": "+0.870",
    "status": "verified",
    "group": "attention",
    "note": "sign-consistent 8 of 8 basins",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "att_mean_q",
    "label": "Attention vs upstream mean discharge",
    "value": "+0.845",
    "status": "verified",
    "group": "attention",
    "note": "significant in 8 of 8",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "att_drainage",
    "label": "Attention vs upstream drainage area",
    "value": "+0.844",
    "status": "verified",
    "group": "attention",
    "note": "significant in 8 of 8",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "att_reach",
    "label": "Attention vs reach length",
    "value": "+0.062",
    "status": "verified",
    "group": "attention",
    "note": "5 of 8 basins",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "tests_passing",
    "label": "Passing tests on the attention evaluator",
    "value": 33,
    "status": "verified",
    "group": "rigor",
    "source": "RESULTS.md §W5.5"
  },
  {
    "id": "undir_coverage_r",
    "label": "Undirected gain vs upstream gauge coverage",
    "value": "−0.06",
    "status": "verified",
    "group": "ablation",
    "note": "the obvious mechanism fails",
    "source": "RESULTS.md §W5.6"
  },
  {
    "id": "gat_vs_gcn",
    "label": "GAT over GCN, ungauged discharge RMSE",
    "value": "+7.79",
    "status": "verified",
    "group": "model",
    "unit": "%",
    "note": "paired t over 3 seeds, p = 0.038",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gat_rmse",
    "label": "GAT ungauged RMSE, 8-basin mean",
    "value": 3.566,
    "status": "verified",
    "group": "model",
    "unit": "m³/s",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gcn_rmse",
    "label": "GCN ungauged RMSE, 8-basin mean",
    "value": 3.867,
    "status": "verified",
    "group": "model",
    "unit": "m³/s",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gat_vs_gcn_held",
    "label": "GAT over GCN, held-out basins only",
    "value": "+8.86",
    "status": "verified",
    "group": "model",
    "unit": "%",
    "note": "p = 0.159 — underpowered at 3 seeds",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gat_pair_wins",
    "label": "Basin–seed pairs where GAT beats GCN",
    "value": "17 / 24",
    "status": "verified",
    "group": "model",
    "note": "t-test on per-pair relative change, p = 1.3e-03",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gat_basins_won",
    "label": "Basins where GAT beats GCN",
    "value": "8 / 8",
    "status": "verified",
    "group": "model",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "gat_vs_mlp",
    "label": "GAT over graph-blind MLP, ungauged",
    "value": "+41.0",
    "status": "verified",
    "group": "model",
    "unit": "%",
    "source": "results/20260830-192452-1440f965dd-main/metrics_per_seed.csv"
  },
  {
    "id": "att_tt_r",
    "label": "Attention vs travel time, hop-stratified r",
    "value": "+0.017",
    "status": "verified",
    "group": "attention",
    "note": "all message edges; permutation null, 1000 draws",
    "source": "results/20260830-192452-1440f965dd-main/attention_scores.csv"
  },
  {
    "id": "att_tt_r_routing",
    "label": "Attention vs travel time, routing edges",
    "value": "-0.129",
    "status": "verified",
    "group": "attention",
    "source": "results/20260830-192452-1440f965dd-main/attention_scores.csv"
  },
  {
    "id": "att_confound",
    "label": "Reach-length confound baseline",
    "value": "+0.438",
    "status": "verified",
    "group": "attention",
    "note": "attention does not beat it",
    "source": "results/20260830-192452-1440f965dd-main/attention_scores.csv"
  },
  {
    "id": "att_entropy",
    "label": "Mean normalised attention entropy",
    "value": 0.875,
    "status": "verified",
    "group": "attention",
    "note": "1.0 = uniform over incoming edges",
    "source": "results/20260830-192452-1440f965dd-main/attention_scores.csv"
  },
  {
    "id": "att_sign",
    "label": "Basins where attention r is positive",
    "value": "3 / 8",
    "status": "verified",
    "group": "attention",
    "source": "results/20260830-192452-1440f965dd-main/attention_scores.csv"
  },
  {
    "id": "att_seed_r",
    "label": "Attention agreement between seeds",
    "value": "+0.386",
    "status": "verified",
    "group": "attention",
    "note": "moderate; show attention across seeds, not from one",
    "source": "results/20260830-192452-1440f965dd-main/attention_seed_consistency.csv"
  },
  {
    "id": "undirected_gain",
    "label": "Undirected graph vs directed reference",
    "value": "+11.1",
    "status": "verified",
    "group": "ablation",
    "unit": "%",
    "note": "p = 0.012, better in 14/24 pairs — larger than the GAT gain",
    "source": "results/ablations.csv"
  },
  {
    "id": "real_gat_rmse",
    "label": "GAT ungauged RMSE on H1–H4 gauge data",
    "value": "—",
    "status": "pending",
    "group": "real",
    "unit": "m³/s",
    "note": "Real network: 4 gauges, 28 cross-sections. Not yet run."
  },
  {
    "id": "real_gat_vs_gcn",
    "label": "GAT vs GCN on H1–H4 gauge data",
    "value": "—",
    "status": "pending",
    "group": "real",
    "unit": "%",
    "note": "Synthetic results above do not transfer automatically."
  },
  {
    "id": "temporal_att_tt",
    "label": "Temporal attention vs travel time, step by step",
    "value": "—",
    "status": "pending",
    "group": "real",
    "unit": "r",
    "note": "Week 6: lag may appear on the temporal axis, not the spatial one."
  },
  {
    "id": "undir_mechanism",
    "label": "Why the undirected graph helps",
    "value": "—",
    "status": "pending",
    "group": "real",
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
    "gcnSd": 0.131,
    "gat": 1.091,
    "gatSd": 0.104,
    "gatVsGcnPct": 0.3
  },
  {
    "basin": "basin_02",
    "split": "train_basin",
    "persistence": 10.999,
    "mlp": 4.862,
    "gcn": 3.674,
    "gcnSd": 0.408,
    "gat": 3.67,
    "gatSd": 0.117,
    "gatVsGcnPct": 0.11
  },
  {
    "basin": "basin_03",
    "split": "train_basin",
    "persistence": 15.828,
    "mlp": 7.745,
    "gcn": 5.083,
    "gcnSd": 0.06,
    "gat": 4.541,
    "gatSd": 0.082,
    "gatVsGcnPct": 10.66
  },
  {
    "basin": "basin_04",
    "split": "train_basin",
    "persistence": 12.274,
    "mlp": 8.357,
    "gcn": 2.758,
    "gcnSd": 0.136,
    "gat": 2.254,
    "gatSd": 0.146,
    "gatVsGcnPct": 18.28
  },
  {
    "basin": "basin_05",
    "split": "train_basin",
    "persistence": 11.322,
    "mlp": 4.422,
    "gcn": 2.245,
    "gcnSd": 0.128,
    "gat": 1.856,
    "gatSd": 0.071,
    "gatVsGcnPct": 17.34
  },
  {
    "basin": "basin_06",
    "split": "train_basin",
    "persistence": 26.671,
    "mlp": 9.088,
    "gcn": 8.392,
    "gcnSd": 0.384,
    "gat": 8.107,
    "gatSd": 0.165,
    "gatVsGcnPct": 3.4
  },
  {
    "basin": "basin_07",
    "split": "held_out",
    "persistence": 10.618,
    "mlp": 6.113,
    "gcn": 3.249,
    "gcnSd": 0.155,
    "gat": 2.914,
    "gatSd": 0.236,
    "gatVsGcnPct": 10.33
  },
  {
    "basin": "basin_08",
    "split": "held_out",
    "persistence": 13.417,
    "mlp": 4.768,
    "gcn": 4.442,
    "gcnSd": 0.438,
    "gat": 4.096,
    "gatSd": 0.33,
    "gatVsGcnPct": 7.79
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
    "rmse": 3.566,
    "vsRefPct": null,
    "p": null,
    "betterIn": null,
    "attnR": 0.017
  },
  {
    "name": "time2vec",
    "detail": "heads=1 edge_dim=2 t2v=True undir=False",
    "rmse": 3.491,
    "vsRefPct": 4.01,
    "p": 0.051,
    "betterIn": "17/24",
    "attnR": 0.013
  },
  {
    "name": "heads4",
    "detail": "heads=4 edge_dim=2 t2v=False undir=False",
    "rmse": 3.591,
    "vsRefPct": -3.32,
    "p": 0.303,
    "betterIn": "9/24",
    "attnR": 0.058
  },
  {
    "name": "noedge",
    "detail": "heads=1 edge_dim=0 t2v=False undir=False",
    "rmse": 3.52,
    "vsRefPct": 2.1,
    "p": 0.236,
    "betterIn": "15/24",
    "attnR": 0.013
  },
  {
    "name": "undirected",
    "detail": "heads=1 edge_dim=2 t2v=False undir=True",
    "rmse": 2.931,
    "vsRefPct": 11.13,
    "p": 0.012,
    "betterIn": "14/24",
    "attnR": 0.025
  },
  {
    "name": "heads8",
    "detail": "heads=8 edge_dim=2 t2v=False undir=False",
    "rmse": 3.549,
    "vsRefPct": 0.01,
    "p": 0.996,
    "betterIn": "12/24",
    "attnR": 0.087
  },
  {
    "name": "heads2",
    "detail": "heads=2 edge_dim=2 t2v=False undir=False",
    "rmse": 3.512,
    "vsRefPct": 1.5,
    "p": 0.386,
    "betterIn": "13/24",
    "attnR": 0.077
  }
]
