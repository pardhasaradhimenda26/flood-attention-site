#!/usr/bin/env python3
"""
generate_data.py — emit src/data/network.ts and src/data/results.ts.

Standalone: Python 3.9+ standard library only. No numpy, no pandas, no site
dependencies. Reads the thesis repo's outputs and writes two TypeScript files
that the site imports. Both are generated; never hand-edit them.

    python scripts/generate_data.py                      # ../Machine Learning Project
    python scripts/generate_data.py "D:/thesis/repo"     # explicit path
    python scripts/generate_data.py --basin basin_03     # hero/attention basin

Sources, when present:
    flood_routing_dataset/nodes.csv, edges.csv, basins.csv, timeseries.csv
    results/<run>/metrics.csv, metrics_per_seed.csv, attention.npz,
                  attention_scores.csv, attention_seed_consistency.csv
    results/ablations.csv
    RESULTS.md                      (only to confirm recorded constants exist)

Status rule: a metric is 'verified' only if the file it is computed from exists
and contains the rows it needs. A missing run, a missing model inside a run, or
a recorded constant that no longer appears in RESULTS.md makes it 'pending'.

If the dataset CSVs are absent, network.ts is generated deterministically from
the seeded spec in the site brief (section 6.1) and results.ts is populated from
the numbers verified in the brief (section 8), with GAT-vs-GCN left pending.
The site builds and renders completely in either mode.
"""

import argparse
import ast
import csv
import datetime as _dt
import io
import json
import math
import os
import random
import struct
import sys
import zipfile
from array import array
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT_DIR = os.path.join(SITE, "src", "data")

HEADER = """// GENERATED FILE — DO NOT HAND-EDIT.
// Written by scripts/generate_data.py on {when}.
// Mode: {mode}. Source: {source}
// Re-run the script to update. Any manual change here is overwritten.
"""


# ---------------------------------------------------------------- utilities

def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def truthy(v):
    return str(v).strip().lower() in ("true", "1", "yes")


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else float("nan")


def r(x, nd=4):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(float(x), nd)


def ts_literal(obj, indent=0):
    """JSON is valid TypeScript for our purposes; keep it compact but legible."""
    return json.dumps(obj, indent=2, ensure_ascii=False)


# --------------------------------------------------- Student-t, pure Python
# Regularised incomplete beta via Lentz's continued fraction (Numerical
# Recipes 6.4). Used for paired-t p-values so they are computed here, not
# copied from the report.

def _betacf(a, b, x):
    MAXIT, EPS, FPMIN = 300, 3e-14, 1e-300
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
    h = d
    for m in range(1, MAXIT + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
        c = 1.0 + aa / c
        c = c if abs(c) > FPMIN else FPMIN
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
        c = 1.0 + aa / c
        c = c if abs(c) > FPMIN else FPMIN
        de = d * c
        h *= de
        if abs(de - 1.0) < EPS:
            break
    return h


def betainc(a, b, x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbt = (math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
           + a * math.log(x) + b * math.log(1 - x))
    bt = math.exp(lbt)
    if x < (a + 1) / (a + b + 2):
        return bt * _betacf(a, b, x) / a
    return 1.0 - bt * _betacf(b, a, 1 - x) / b


def paired_t_p(xs, ys):
    """Two-sided paired t-test p-value."""
    d = [x - y for x, y in zip(xs, ys)]
    n = len(d)
    if n < 2:
        return None
    md = mean(d)
    sd = math.sqrt(sum((v - md) ** 2 for v in d) / (n - 1))
    if sd == 0:
        return 0.0
    t = md / (sd / math.sqrt(n))
    df = n - 1
    return betainc(df / 2.0, 0.5, df / (df + t * t))


# ------------------------------------------- .npy reader (no numpy needed)

def read_npz(path):
    out = {}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            raw = z.read(name)
            if raw[:6] != b"\x93NUMPY":
                continue
            major = raw[6]
            if major == 1:
                hlen = struct.unpack("<H", raw[8:10])[0]
                start = 10
            else:
                hlen = struct.unpack("<I", raw[8:12])[0]
                start = 12
            header = ast.literal_eval(raw[start:start + hlen].decode("latin1"))
            descr, shape = header["descr"], tuple(header["shape"])
            if header.get("fortran_order"):
                raise ValueError(f"{name}: fortran order unsupported")
            code = {"<f4": "f", "<f8": "d", "<i4": "i", "<i8": "q"}.get(descr)
            if code is None:
                raise ValueError(f"{name}: dtype {descr} unsupported")
            arr = array(code)
            arr.frombytes(raw[start + hlen:])
            if sys.byteorder != "little":
                arr.byteswap()
            key = name[:-4] if name.endswith(".npy") else name
            out[key] = (shape, arr)
    return out


# ------------------------------------------- Muskingum, ported verbatim
# Same algorithm as data/generate_flood_dataset.py::muskingum_route, so the
# per-edge dispersion the site draws is the dispersion the dataset contains.

def muskingum_route(inflow, K_s, X, dt_s=3600.0):
    target_K_sub = 1.5 * dt_s
    n_sub = max(1, int(round(K_s / target_K_sub)))
    K_sub = K_s / n_sub
    denom = K_sub - K_sub * X + 0.5 * dt_s
    C0 = (-K_sub * X + 0.5 * dt_s) / denom
    C1 = (K_sub * X + 0.5 * dt_s) / denom
    C2 = (K_sub - K_sub * X - 0.5 * dt_s) / denom
    q = list(inflow)
    for _ in range(n_sub):
        out = [0.0] * len(q)
        out[0] = q[0]
        for t in range(1, len(q)):
            out[t] = C0 * q[t] + C1 * q[t - 1] + C2 * out[t - 1]
        q = out
    return q


def edge_moments(K_s, X):
    """Mean lag (h) and variance (h^2) of the reach's discrete impulse response."""
    n = int(K_s / 3600.0 * 6) + 80
    pulse = [0.0] * n
    pulse[1] = 1.0
    out = muskingum_route(pulse, K_s, X)
    tot = sum(out)
    m1 = sum(t * v for t, v in enumerate(out)) / tot
    var = sum((t - m1) ** 2 * v for t, v in enumerate(out)) / tot
    # lag measured from the impulse at t=1
    return m1 - 1.0, var


# --------------------------------------------------------- network: thesis

def short_label(node_id, basin):
    s = node_id.replace(basin + "_", "")
    if s.startswith("main_"):
        return "M" + s[5:]
    if s.startswith("trib"):
        letter = s[4].upper()
        return "T" + letter + s.split("_")[1]
    return s


def build_network_from_thesis(repo, basin):
    ds = os.path.join(repo, "flood_routing_dataset")
    nodes_all = read_csv(os.path.join(ds, "nodes.csv"))
    edges_all = read_csv(os.path.join(ds, "edges.csv"))
    basins_rows = read_csv(os.path.join(ds, "basins.csv")) if os.path.exists(
        os.path.join(ds, "basins.csv")) else []

    nodes = [n for n in nodes_all if n["basin_id"] == basin]
    if not nodes:
        raise SystemExit(f"basin {basin} not found in nodes.csv")
    ids = {n["node_id"] for n in nodes}
    # Edge order preserved exactly as edges.csv: attention.npz is aligned to it.
    edges = [e for e in edges_all if e["source_node"] in ids and e["target_node"] in ids]

    elev = [float(n["elevation_m"]) for n in nodes]
    e_lo, e_hi = min(elev), max(elev)
    rng = random.Random(f"meander-{basin}")
    # Seeded meander phase per branch, so the layout is stable across runs.
    phases = defaultdict(lambda: rng.uniform(0, math.tau))
    max_pos = defaultdict(float)
    for n in nodes:
        br = n["node_id"].rsplit("_", 1)[0]
        max_pos[br] = max(max_pos[br], float(n["path_position"]))

    out_nodes = []
    for n in nodes:
        br = n["node_id"].rsplit("_", 1)[0]
        cx, cy = float(n["coord_x"]), float(n["coord_y"])
        pp = float(n["path_position"])
        ph = phases[br]
        x = (cx - 0.5) * 22.0
        if n["branch"] == "main_stem":
            z = 0.55 * math.sin(cx * 9.0 + ph) + 0.25 * math.sin(cx * 23.0 + ph * 2)
        else:
            frac = pp / max_pos[br] if max_pos[br] else 0
            z = cy * 8.5 * (1.18 - 0.38 * frac) + 0.3 * math.sin(pp * 20 + ph)
        y = (float(n["elevation_m"]) - e_lo) / (e_hi - e_lo) * 2.6
        out_nodes.append({
            "id": n["node_id"],
            "label": short_label(n["node_id"], basin),
            "branch": "main" if n["branch"] == "main_stem" else br.split("_")[-1],
            "pathPosition": r(pp, 3),
            "pos": [r(x, 3), r(y, 3), r(z, 3)],
            "elevationM": r(float(n["elevation_m"]), 2),
            "channelSlope": r(float(n["channel_slope"]), 6),
            "channelWidthM": r(float(n["channel_width_m"]), 2),
            "manningN": r(float(n["manning_n"]), 4),
            "localAreaKm2": r(float(n["local_area_km2"]), 3),
            "drainageAreaKm2": r(float(n["drainage_area_km2"]), 3),
            "gauged": truthy(n["is_gauged"]),
            "gaugeRole": n.get("gauge_role") or None,
        })

    out_edges = []
    for i, e in enumerate(edges):
        routing = truthy(e["is_routing_edge"])
        # Message-only (multi-hop) edges carry no Muskingum parameters.
        K_s = float(e["muskingum_K_s"]) if e["muskingum_K_s"] else float(e["travel_time_hours"]) * 3600.0
        X = float(e["muskingum_X"]) if e["muskingum_X"] else 0.0
        lag, var = edge_moments(K_s, X) if routing else (None, None)
        out_edges.append({
            "id": i,
            "source": e["source_node"],
            "target": e["target_node"],
            "hops": int(e["n_hops"]),
            "routing": routing,
            "travelTimeHours": r(float(e["travel_time_hours"]), 3),
            "reachLengthM": r(float(e["reach_length_m"]), 1),
            "celerityMs": r(float(e["wave_celerity_ms"]), 3),
            "muskingumKHours": r(K_s / 3600.0, 3) if routing else None,
            "muskingumX": r(X, 3) if routing else None,
            # Variance (h^2) the dataset's own discrete routing adds per reach.
            "dispersionHours2": r(var, 3) if var is not None else None,
        })

    basin_meta = next((b for b in basins_rows if b["basin_id"] == basin), None)
    basins = [{
        "id": b["basin_id"],
        "character": b["character"].replace("_", " "),
        "celerityMs": r(float(b["reference_celerity_ms"]), 2),
        "manningN": r(float(b["manning_n"]), 3),
        "runoffCoefficient": r(float(b["runoff_coefficient"]), 2),
        "nodes": int(b["n_nodes"]),
        "edges": int(b["n_edges"]),
        "routingEdges": int(b["n_routing_edges"]),
        "tributaries": int(b["n_tributaries"]),
        "gauged": int(b["n_gauged"]),
    } for b in basins_rows]

    return {
        "basinId": basin,
        "character": basin_meta["character"].replace("_", " ") if basin_meta else None,
        "nodes": out_nodes,
        "edges": out_edges,
        "basins": basins,
    }


# -------------------------------------------------- network: seeded spec

def build_network_from_spec():
    """Brief section 6.1: ~14-node main stem, 2 tributaries, 4 gauged."""
    rng = random.Random(1337)
    basin = "spec_basin"
    nodes, edges = [], []

    def add_branch(prefix, n, x0, x1, ybase, e0, e1, a0, gauge_at):
        out = []
        for k in range(n):
            f = k / (n - 1)
            nid = f"{basin}_{prefix}_{k:02d}"
            out.append({
                "node_id": nid, "branch": "main_stem" if prefix == "main" else "tributary",
                "path_position": f * (1 if prefix == "main" else 0.35),
                "elevation_m": e0 + (e1 - e0) * f + rng.uniform(-8, 8),
                "channel_slope": 0.004 + rng.uniform(0, 0.006),
                "manning_n": 0.035 + rng.uniform(-0.006, 0.006),
                "coord_x": x0 + (x1 - x0) * f, "coord_y": ybase,
                "local_area_km2": 5 + rng.uniform(0, 4),
                "is_gauged": k in gauge_at[0], "gauge_role": gauge_at[1].get(k, ""),
            })
        return out

    main = add_branch("main", 14, 0.0, 1.0, 0.0, 820, 110, 6, ({0, 7, 13}, {0: "headwater", 7: "mid_basin", 13: "outlet"}))
    ta = add_branch("triba", 5, 0.12, 0.30, 0.4, 860, 560, 3, ({4}, {4: "tributary"}))
    tb = add_branch("tribb", 4, 0.55, 0.68, -0.4, 700, 330, 3, (set(), {}))
    for g in (main, ta, tb):
        nodes += g

    def link(a, b, hops=1):
        L = rng.uniform(17000, 56000)
        c = rng.uniform(0.9, 1.9)
        K = L / c
        edges.append({"source_node": a["node_id"], "target_node": b["node_id"],
                      "reach_length_m": L, "wave_celerity_ms": c, "muskingum_K_s": K,
                      "muskingum_X": rng.uniform(0.1, 0.3), "travel_time_hours": K / 3600,
                      "n_hops": hops, "is_routing_edge": hops == 1})

    for g in (main, ta, tb):
        for a, b in zip(g, g[1:]):
            link(a, b)
    link(ta[-1], main[5])
    link(tb[-1], main[9])

    # drainage area accumulates downstream
    area = {n["node_id"]: n["local_area_km2"] for n in nodes}
    order = [n["node_id"] for n in ta + tb + main]
    ups = defaultdict(list)
    for e in edges:
        ups[e["target_node"]].append(e["source_node"])
    acc = {}
    for nid in order:
        acc[nid] = area[nid] + sum(acc.get(u, 0) for u in ups[nid])
    for n in nodes:
        n["drainage_area_km2"] = acc[n["node_id"]]
        n["channel_width_m"] = 3.0 * acc[n["node_id"]] ** 0.5

    # Write through the thesis path so both modes share one layout routine.
    tmp = {"nodes": nodes, "edges": edges}
    return _layout_from_rows(tmp, basin)


def _layout_from_rows(tmp, basin):
    nodes, edges = tmp["nodes"], tmp["edges"]
    elev = [n["elevation_m"] for n in nodes]
    e_lo, e_hi = min(elev), max(elev)
    out_nodes = []
    for n in nodes:
        cx, cy = n["coord_x"], n["coord_y"]
        x = (cx - 0.5) * 22.0
        z = (0.55 * math.sin(cx * 9.0 + 1.3) if n["branch"] == "main_stem"
             else cy * 8.5 * (1.18 - 0.38 * n["path_position"] / 0.35))
        y = (n["elevation_m"] - e_lo) / (e_hi - e_lo) * 2.6
        out_nodes.append({
            "id": n["node_id"], "label": short_label(n["node_id"], basin),
            "branch": "main" if n["branch"] == "main_stem" else n["node_id"].split("_")[-2],
            "pathPosition": r(n["path_position"], 3),
            "pos": [r(x, 3), r(y, 3), r(z, 3)],
            "elevationM": r(n["elevation_m"], 2), "channelSlope": r(n["channel_slope"], 6),
            "channelWidthM": r(n["channel_width_m"], 2), "manningN": r(n["manning_n"], 4),
            "localAreaKm2": r(n["local_area_km2"], 3), "drainageAreaKm2": r(n["drainage_area_km2"], 3),
            "gauged": bool(n["is_gauged"]), "gaugeRole": n["gauge_role"] or None,
        })
    out_edges = []
    for i, e in enumerate(edges):
        lag, var = edge_moments(e["muskingum_K_s"], e["muskingum_X"])
        out_edges.append({
            "id": i, "source": e["source_node"], "target": e["target_node"], "hops": 1,
            "routing": True, "travelTimeHours": r(e["travel_time_hours"], 3),
            "reachLengthM": r(e["reach_length_m"], 1), "celerityMs": r(e["wave_celerity_ms"], 3),
            "muskingumKHours": r(e["muskingum_K_s"] / 3600, 3), "muskingumX": r(e["muskingum_X"], 3),
            "dispersionHours2": r(var, 3),
        })
    return {"basinId": basin, "character": "seeded spec (brief §6.1)",
            "nodes": out_nodes, "edges": out_edges, "basins": []}


def synth_event(net):
    """Spec mode: route a gamma-shaped headwater storm through the network."""
    hours = 360
    onset = 60  # leave room before the storm for a model input window
    storm = [0.4 + (7.0 * (((t - onset) / 9.0) ** 2) * math.exp(-(t - onset) / 4.5) if t >= onset else 0.0)
             for t in range(hours)]
    return route_event_through(net, storm, hours)


def route_event_through(net, head_series, hours):
    nodes = {n["id"]: n for n in net["nodes"]}
    routing = [e for e in net["edges"] if e["routing"]]
    ups = defaultdict(list)
    for e in routing:
        ups[e["target"]].append(e)
    q = {}

    def solve(nid):
        if nid in q:
            return q[nid]
        base = [0.25 * nodes[nid]["localAreaKm2"] / 6.0] * hours
        if not ups[nid]:
            scale = nodes[nid]["drainageAreaKm2"] / 6.6
            q[nid] = [b + s * scale for b, s in zip(base, head_series)]
            return q[nid]
        acc = base[:]
        for e in ups[nid]:
            routed = muskingum_route(solve(e["source"]), e["muskingumKHours"] * 3600, e["muskingumX"])
            acc = [a + b for a, b in zip(acc, routed)]
        q[nid] = acc
        return acc

    for nid in nodes:
        solve(nid)
    return q


# ------------------------------------------------------------ storm events

def extract_events(repo, net):
    """Real timeseries: one event, recorded at two main-stem gauges, plus a
    36-hour model window (24 h seen + 12 h forecast) for every node."""
    path = os.path.join(repo, "flood_routing_dataset", "timeseries.csv")
    basin = net["basinId"]
    ids = [n["id"] for n in net["nodes"]]
    series = defaultdict(list)
    rain = defaultdict(list)
    with open(path, newline="", encoding="utf-8") as fh:
        rd = csv.reader(fh)
        h = next(rd)
        ix = {k: i for i, k in enumerate(h)}
        for row in rd:
            if row[ix["basin_id"]] != basin:
                continue
            series[row[ix["node_id"]]].append(float(row[ix["discharge_m3s"]]))
            rain[row[ix["node_id"]]].append(float(row[ix["precipitation_mm"]]))
    return series, rain


def pick_event(net, series):
    gauges = [n for n in net["nodes"] if n["gauged"] and n["branch"] == "main"]
    gauges.sort(key=lambda n: n["pathPosition"])
    up, down = gauges[0], gauges[1]
    q_up = series[up["id"]]
    n = len(q_up)
    # largest headwater peak with room for the downstream response
    lo, hi = min(30, n // 4), max(min(30, n // 4) + 1, n - 140)
    cands = sorted(range(lo, hi), key=lambda i: -q_up[i])
    i0 = cands[0]
    return up, down, i0


def problem_hydrograph(net, series, up, down, i0):
    start, length = i0 - 18, 120
    rec_up = series[up["id"]][start:start + length]
    rec_down = series[down["id"]][start:start + length]
    # Route the headwater record alone, along the main stem, with the
    # dataset's own K and X: lag and attenuation without local inflow.
    path = []
    cur = up["id"]
    routing = {e["source"]: e for e in net["edges"] if e["routing"]}
    while cur != down["id"]:
        e = routing[cur]
        path.append(e)
        cur = e["target"]
    full_up = series[up["id"]][max(0, start - 200):start + length]
    routed = full_up
    for e in path:
        routed = muskingum_route(routed, e["muskingumKHours"] * 3600, e["muskingumX"])
    routed = routed[-length:]
    travel = sum(e["travelTimeHours"] for e in path)
    return {
        "upstream": {"id": up["id"], "label": up["label"], "role": up["gaugeRole"]},
        "downstream": {"id": down["id"], "label": down["label"], "role": down["gaugeRole"]},
        "reaches": len(path),
        "pathTravelHours": r(travel, 2),
        "hours": list(range(length)),
        "recordedUpstream": [r(v, 3) for v in rec_up],
        "recordedDownstream": [r(v, 3) for v in rec_down],
        "routedUpstreamOnly": [r(v, 3) for v in routed],
    }


def model_window(net, series, i0):
    # Forecast origin set on the confluence's rising limb, where the
    # attention question is live.
    conf = confluence_id(net)
    q = series[conf]
    seg = q[i0:i0 + 120]
    peak = i0 + max(range(len(seg)), key=lambda k: seg[k])
    origin = peak - 6
    lo = origin - 24
    return {
        "originIndex": 24,
        "inputSteps": 24,
        "rolloutSteps": 12,
        "series": {nid: [r(v, 3) for v in series[nid][lo:lo + 36]] for nid in series},
    }


def confluence_id(net):
    """The confluence whose incoming routing reaches differ most in travel time."""
    routing = [e for e in net["edges"] if e["routing"]]
    ups = defaultdict(list)
    for e in routing:
        ups[e["target"]].append(e)
    best, gap = None, -1
    for nid, es in ups.items():
        if len(es) >= 2:
            tt = [e["travelTimeHours"] for e in es]
            if max(tt) - min(tt) > gap:
                best, gap = nid, max(tt) - min(tt)
    return best


# ------------------------------------------------------------- attention

def find_runs(repo):
    root = os.path.join(repo, "results")
    if not os.path.isdir(root):
        return []
    runs = [os.path.join(root, d) for d in sorted(os.listdir(root))
            if os.path.isdir(os.path.join(root, d))]
    return runs


def models_in(run):
    p = os.path.join(run, "metrics.csv")
    if not os.path.exists(p):
        return set()
    with open(p, newline="", encoding="utf-8") as fh:
        return {row["model"] for row in csv.DictReader(fh)}


def pick_main_run(runs):
    """Latest run that contains all four models; prefer a '-main' suffix."""
    full = [r_ for r_ in runs if {"persistence", "mlp", "gcn", "gat"} <= models_in(r_)]
    mains = [r_ for r_ in full if r_.endswith("-main")]
    if mains:
        return mains[-1], True
    if full:
        return full[-1], True
    partial = [r_ for r_ in runs if {"persistence", "mlp", "gcn"} <= models_in(r_)]
    return (partial[-1], False) if partial else (None, False)


def attention_for(run, net):
    path = os.path.join(run, "attention.npz") if run else None
    if not path or not os.path.exists(path):
        return None
    arrays = read_npz(path)
    basin = net["basinId"]
    keys = sorted(k for k in arrays if k.startswith(f"gat|{basin}|"))
    if not keys:
        return None
    E = len(net["edges"])
    per_seed = []
    for k in keys:
        shape, a = arrays[k]
        L, S, Ek = shape
        if Ek != E:
            raise SystemExit(f"{k}: {Ek} edges in attention, {E} in edges.csv")
        last = L - 1
        per_seed.append([[a[(last * S + s) * Ek + e] for e in range(Ek)] for s in range(S)])
    S = len(per_seed[0])
    meanw = [[r(mean(ps[s][e] for ps in per_seed), 4) for e in range(E)] for s in range(S)]
    loww = [[r(min(ps[s][e] for ps in per_seed), 4) for e in range(E)] for s in range(S)]
    highw = [[r(max(ps[s][e] for ps in per_seed), 4) for e in range(E)] for s in range(S)]
    return {
        "run": os.path.basename(run),
        "layer": "last of 3",
        "seeds": len(per_seed),
        "steps": S,
        "mean": meanw,
        "low": loww,
        "high": highw,
    }


# ---------------------------------------------------------------- results

class Metrics:
    def __init__(self):
        self.items = []

    def add(self, id, label, value, unit=None, status="verified", note=None, group="misc", source=None):
        m = {"id": id, "label": label, "value": value, "status": status, "group": group}
        if unit:
            m["unit"] = unit
        if note:
            m["note"] = note
        if source:
            m["source"] = source
        self.items.append(m)


def results_md_has(repo, needle):
    p = os.path.join(repo, "RESULTS.md")
    if not os.path.exists(p):
        return False
    with open(p, encoding="utf-8") as fh:
        return needle in fh.read()


# Recorded constants: numbers produced by scripts that print rather than write
# CSVs (gate test, Week 4 information test, untrained-model check, attention
# correlates). Each is verified only while RESULTS.md still contains the value.
RECORDED = [
    # id, label, value, unit, group, needle, section, note
    ("real_sections", "Real network: surveyed cross-sections", 28, None, "real", "4 of 28", "W5.1 A1", "H1–H4 network"),
    ("real_gauges", "Real network: gauges", 4, None, "real", "4 of 28", "W5.1 A1", "H1–H4"),
    ("real_ungauged", "Real network: cross-sections without a gauge", 86, "%", "real", "4 of 28", "W5.1 A1", "24 of 28"),
    ("repro", "Reproducibility re-run of a headline table", "identical", None, "rigor", "reproduced the headline table", "Week 4 §8", "metrics.csv byte-identical to the original run"),
    ("mass_balance", "Mass balance, all basins", "1.0000", None, "dataset", "1.0000 in all 8 basins", "W5.1 A5", None),
    ("storm_kernel", "Storm kernel width (2-D Gaussian)", 0.18, None, "dataset", "width 0.18", "W5.1 A2", "over along-flow position and branch offset"),
    ("dry_rise", "Rising node-hours under dry sky", 12.0, "%", "dataset", "**12.0%**", "W5.1 A2", "samples local forcing cannot explain"),
    ("w4_own_r2", "Own 24-step history, R² at 1 h", 0.9998, None, "week4", "0.9998", "Week 4 §4b", None),
    ("w4_gain_1h", "Mean R² gain from upstream history, 1 h", "+0.0001", None, "week4", "**+0.0001**", "Week 4 §4b", None),
    ("w4_gain_6h", "Mean R² gain from upstream history, 6 h", "+0.005", None, "week4", "+0.0045", "Week 4 §4b", "reported +0.0045"),
    ("w4_gain_12h", "Mean R² gain from upstream history, 12 h", "−0.014", None, "week4", "−0.0144", "Week 4 §4b", None),
    ("w4_gcn_win", "GCN over MLP, the one basin it won", "+11.2", "%", "week4", "+11.2%", "Week 4 §3", "basin_02, p = 0.039; one basin of three"),
    ("w4_gcn_held", "GCN vs MLP, held-out basin", "−15", "%", "week4", "worse** by 15%", "Week 4 §3", "GCN 2–4× more variable across seeds"),
    ("gate_all", "Gate ΔR², all ungauged nodes", "+0.181", None, "gate", "+0.1809", "W5.2", "threshold 0.05; 7 of 8 basins"),
    ("gate_served", "Gate ΔR², ungauged nodes with a gauged ancestor", "+0.242", None, "gate", "+0.2416", "W5.2", "8 of 8 basins"),
    ("gate_k1", "Gate ΔR² at lead 1 h", "+0.236", None, "gate", "+0.2363", "W5.2", None),
    ("gate_k6", "Gate ΔR² at lead 6 h", "+0.241", None, "gate", "+0.2411", "W5.2", None),
    ("gate_k12", "Gate ΔR² at lead 12 h", "+0.247", None, "gate", "+0.2474", "W5.2", None),
    ("gate_b08", "basin_08, all ungauged nodes", "−0.005", None, "gate", "**−0.005**", "W5.2", "10 of 26 ungauged nodes have no gauged ancestor"),
    ("gate_b08_served", "basin_08, served nodes only", "+0.012", None, "gate", "**+0.012**", "W5.2", None),
    ("gate_coverage", "Ungauged nodes with a gauged ancestor in 9 hops", 63, "%", "gate", "126 of 201 ungauged nodes (63%)", "W5.2", "126 of 201"),
    ("trap_untrained", "Plain within-node r, untrained GATv2", 0.956, None, "attention", "**0.956**", "W5.5", "the false headline the metric would have produced"),
    ("trap_confound", "within-node r(reach length, travel time)", "+0.97 to +0.99", None, "attention", "+0.97 to +0.99", "W5.5", "hop count drives both"),
    ("ref_routing", "Naive cross-correlation reference, routing edges", 0.698, None, "attention", "r = 0.698", "W5.1 A5", "re-derived on the Week 5 dataset"),
    ("ref_all", "Naive cross-correlation reference, all message edges", 0.769, None, "attention", "r = 0.769", "W5.1 A5", None),
    ("att_local_area", "Attention vs upstream local area", "+0.870", None, "attention", "+0.870", "W5.5", "sign-consistent 8 of 8 basins"),
    ("att_mean_q", "Attention vs upstream mean discharge", "+0.845", None, "attention", "+0.845", "W5.5", "significant in 8 of 8"),
    ("att_drainage", "Attention vs upstream drainage area", "+0.844", None, "attention", "+0.844", "W5.5", "significant in 8 of 8"),
    ("att_reach", "Attention vs reach length", "+0.062", None, "attention", "+0.062", "W5.5", "5 of 8 basins"),
    ("tests_passing", "Passing tests on the attention evaluator", 33, None, "rigor", "33 passing", "W5.5", None),
    ("undir_coverage_r", "Undirected gain vs upstream gauge coverage", "−0.06", None, "ablation", "**−0.06**", "W5.6", "the obvious mechanism fails"),
]

# Recorded constants that the site brief (section 8/9) itself lists. Without the
# thesis repo, only these may be shown as verified; the rest stay pending.
IN_BRIEF = {
    "real_sections", "real_gauges", "real_ungauged", "mass_balance", "storm_kernel",
    "w4_own_r2", "w4_gain_6h", "w4_gain_12h", "w4_gcn_win", "w4_gcn_held",
    "gate_all", "gate_served", "gate_k1", "gate_k12", "gate_b08", "gate_b08_served",
    "gate_coverage", "trap_untrained", "trap_confound", "ref_routing", "ref_all", "tests_passing",
}

# Things nobody has measured yet. Always pending until a real run exists.
PENDING_ALWAYS = [
    ("real_gat_rmse", "GAT ungauged RMSE on H1–H4 gauge data", "—", "m³/s", "real", "Real network: 4 gauges, 28 cross-sections. Not yet run."),
    ("real_gat_vs_gcn", "GAT vs GCN on H1–H4 gauge data", "—", "%", "real", "Synthetic results above do not transfer automatically."),
    ("temporal_att_tt", "Temporal attention vs travel time, step by step", "—", "r", "real", "Week 6: lag may appear on the temporal axis, not the spatial one."),
    ("undir_mechanism", "Why the undirected graph helps", "—", None, "real", "Effect measured; mechanism unconfirmed."),
]


def build_results(repo, net, mode):
    M = Metrics()
    prov = {"mode": mode, "runs": []}

    # ---- dataset counts, computed directly
    ds = os.path.join(repo, "flood_routing_dataset") if repo else None
    have_ds = ds and os.path.exists(os.path.join(ds, "nodes.csv"))
    if have_ds:
        nodes = read_csv(os.path.join(ds, "nodes.csv"))
        edges = read_csv(os.path.join(ds, "edges.csv"))
        basins = {n["basin_id"] for n in nodes}
        g = sum(truthy(n["is_gauged"]) for n in nodes)
        routing = [e for e in edges if truthy(e["is_routing_edge"])]
        tt = mean(float(e["travel_time_hours"]) for e in routing)
        src = "flood_routing_dataset/*.csv"
        M.add("basins", "Basins", len(basins), group="dataset", source=src)
        M.add("nodes", "Cross-section nodes", len(nodes), group="dataset", source=src)
        M.add("edges", "Directed edges", len(edges), group="dataset", source=src,
              note=f"{len(routing)} routing + {len(edges) - len(routing)} message-only (2–3 hops)")
        M.add("gauged", "Gauged nodes", g, group="dataset", source=src)
        M.add("gauged_pct", "Share of nodes gauged", r(100 * g / len(nodes), 1), "%", group="dataset", source=src)
        M.add("mean_tt", "Mean 1-hop travel time", r(tt, 2), "h", group="dataset", source=src)
        M.add("horizon_ratio", "Rollout horizon / mean travel time", r(12 / tt, 2), "×", group="dataset", source=src,
              note="12-step rollout")
    else:
        for id_, label, val, unit, note in [
            ("basins", "Basins", 8, None, None), ("nodes", "Cross-section nodes", 233, None, None),
            ("edges", "Directed edges", 651, None, None), ("gauged", "Gauged nodes", 32, None, None),
            ("gauged_pct", "Share of nodes gauged", 13.7, "%", None),
            ("horizon_ratio", "Rollout horizon / mean travel time", 1.57, "×", "12-step rollout")]:
            M.add(id_, label, val, unit, group="dataset", note=note, source="brief §8")

    # ---- recorded constants
    for id_, label, val, unit, group, needle, section, note in RECORDED:
        if repo and os.path.exists(os.path.join(repo, "RESULTS.md")):
            ok = results_md_has(repo, needle)
            M.add(id_, label, val, unit, "verified" if ok else "pending", note if ok else
                  f"not found in RESULTS.md ({section}); re-check before publishing",
                  group, f"RESULTS.md §{section}")
        elif id_ in IN_BRIEF:
            M.add(id_, label, val, unit, "verified", note, group, "brief §8")
        else:
            M.add(id_, label, val, unit, "pending", "not listed in the brief; needs the thesis repo", group, None)

    # ---- main run
    runs = find_runs(repo) if repo else []
    main, has_gat = pick_main_run(runs)
    rollout = None
    basin_cmp = None
    att_basins = None
    ablations = None

    if main:
        prov["runs"].append(os.path.basename(main))
        rows = read_csv(os.path.join(main, "metrics.csv"))
        models = ["persistence", "mlp", "gcn", "gat"]
        steps = sorted({int(x["rollout_step"]) for x in rows})
        rollout = {"variable": "discharge_m3s", "unit": "m³/s", "steps": steps, "run": os.path.basename(main),
                   "panels": {}}
        for grp in ("gauged", "ungauged"):
            panel = []
            for m in models:
                sel = [x for x in rows if x["model"] == m and x["variable"] == "discharge_m3s" and x["node_group"] == grp]
                if not sel:
                    panel.append({"model": m, "status": "pending", "values": []})
                    continue
                vals = []
                for s in steps:
                    vs = [float(x["rmse_mean"]) for x in sel if int(x["rollout_step"]) == s]
                    vals.append(r(mean(vs), 4))
                panel.append({"model": m, "status": "verified", "values": vals})
            rollout["panels"][grp] = panel

        def basin_mean(model, grp="ungauged"):
            out = {}
            for b in sorted({x["basin"] for x in rows}):
                sel = [x for x in rows if x["model"] == model and x["basin"] == b and
                       x["variable"] == "discharge_m3s" and x["node_group"] == grp]
                if sel:
                    out[b] = (mean(float(x["rmse_mean"]) for x in sel), mean(float(x["rmse_std"]) for x in sel),
                              sel[0]["split"])
            return out

        gcn_b, gat_b, mlp_b, per_b = basin_mean("gcn"), basin_mean("gat"), basin_mean("mlp"), basin_mean("persistence")
        if gat_b:
            basin_cmp = [{
                "basin": b, "split": gcn_b[b][2],
                "persistence": r(per_b[b][0], 3), "mlp": r(mlp_b[b][0], 3),
                "gcn": r(gcn_b[b][0], 3), "gcnSd": r(gcn_b[b][1], 3),
                "gat": r(gat_b[b][0], 3), "gatSd": r(gat_b[b][1], 3),
                "gatVsGcnPct": r(100 * (gcn_b[b][0] - gat_b[b][0]) / gcn_b[b][0], 2),
            } for b in sorted(gcn_b)]

        # pooled per seed and per (basin, seed), from metrics_per_seed
        ps_path = os.path.join(main, "metrics_per_seed.csv")
        src = f"results/{os.path.basename(main)}/metrics_per_seed.csv"
        if has_gat and os.path.exists(ps_path):
            ps = read_csv(ps_path)
            cell = defaultdict(list)
            for x in ps:
                if x["variable"] == "discharge_m3s" and x["node_group"] == "ungauged":
                    cell[(x["model"], x["basin"], int(x["seed"]))].append(float(x["rmse"]))
            cm = {k: mean(v) for k, v in cell.items()}
            seeds = sorted({k[2] for k in cm})
            basins_ = sorted({k[1] for k in cm})
            held = sorted({x["basin"] for x in ps if x["split"] == "held_out"})

            def pooled(model, bs):
                return [mean(cm[(model, b, s)] for b in bs) for s in seeds]

            gat_s, gcn_s = pooled("gat", basins_), pooled("gcn", basins_)
            imp = 100 * (mean(gcn_s) - mean(gat_s)) / mean(gcn_s)
            M.add("gat_vs_gcn", "GAT over GCN, ungauged discharge RMSE", f"+{imp:.2f}", "%", group="model",
                  note=f"paired t over {len(seeds)} seeds, p = {paired_t_p(gcn_s, gat_s):.3f}", source=src)
            M.add("gat_rmse", "GAT ungauged RMSE, 8-basin mean", r(mean(gat_s), 3), "m³/s", group="model", source=src)
            M.add("gcn_rmse", "GCN ungauged RMSE, 8-basin mean", r(mean(gcn_s), 3), "m³/s", group="model", source=src)
            gh, ch = pooled("gat", held), pooled("gcn", held)
            M.add("gat_vs_gcn_held", "GAT over GCN, held-out basins only",
                  f"+{100 * (mean(ch) - mean(gh)) / mean(ch):.2f}", "%", group="model",
                  note=f"p = {paired_t_p(ch, gh):.3f} — underpowered at {len(seeds)} seeds", source=src)
            pairs = [(cm[("gcn", b, s)], cm[("gat", b, s)]) for b in basins_ for s in seeds]
            wins = sum(1 for c, a in pairs if a < c)
            # Same test as RESULTS.md: one-sample t on per-pair relative change.
            rel = [(c - a) / c for c, a in pairs]
            M.add("gat_pair_wins", "Basin–seed pairs where GAT beats GCN", f"{wins} / {len(pairs)}", group="model",
                  note=f"t-test on per-pair relative change, p = {paired_t_p(rel, [0.0] * len(rel)):.1e}", source=src)
            basins_won = sum(1 for b in basins_ if mean(cm[("gat", b, s)] for s in seeds) < mean(cm[("gcn", b, s)] for s in seeds))
            M.add("gat_basins_won", "Basins where GAT beats GCN", f"{basins_won} / {len(basins_)}", group="model", source=src)
            mlp_s = pooled("mlp", basins_)
            M.add("gat_vs_mlp", "GAT over graph-blind MLP, ungauged", f"+{100 * (mean(mlp_s) - mean(gat_s)) / mean(mlp_s):.1f}", "%",
                  group="model", source=src)
        else:
            for id_, label in [("gat_vs_gcn", "GAT over GCN, ungauged discharge RMSE"),
                               ("gat_rmse", "GAT ungauged RMSE, 8-basin mean")]:
                M.add(id_, label, "—", None, "pending", "GAT run not complete", "model", "results/")

        # attention scores
        sp = os.path.join(main, "attention_scores.csv")
        if os.path.exists(sp):
            a = read_csv(sp)
            src = f"results/{os.path.basename(main)}/attention_scores.csv"
            M.add("att_tt_r", "Attention vs travel time, hop-stratified r", f"{mean(float(x['hop_strat_r_all']) for x in a):+.3f}",
                  group="attention", note="all message edges; permutation null, 1000 draws", source=src)
            M.add("att_tt_r_routing", "Attention vs travel time, routing edges", f"{mean(float(x['hop_strat_r_routing']) for x in a):+.3f}",
                  group="attention", source=src)
            M.add("att_confound", "Reach-length confound baseline", f"{mean(float(x['confound_length_r']) for x in a):+.3f}",
                  group="attention", note="attention does not beat it", source=src)
            M.add("att_entropy", "Mean normalised attention entropy", r(mean(float(x["mean_entropy"]) for x in a), 3),
                  group="attention", note="1.0 = uniform over incoming edges", source=src)
            by_b = defaultdict(list)
            for x in a:
                by_b[x["basin"]].append(x)
            att_basins = []
            pos_sig = 0
            for b in sorted(by_b):
                xs = by_b[b]
                rr = mean(float(x["hop_strat_r_all"]) for x in xs)
                pp = mean(float(x["p_all"]) for x in xs)
                att_basins.append({"basin": b, "r": r(rr, 3), "p": r(pp, 3)})
            signs = sum(1 for x in att_basins if x["r"] > 0)
            M.add("att_sign", "Basins where attention r is positive", f"{signs} / {len(att_basins)}", group="attention", source=src)
        else:
            M.add("att_tt_r", "Attention vs travel time, hop-stratified r", "—", None, "pending",
                  "attention_scores.csv missing", "attention", "results/")
        cp = os.path.join(main, "attention_seed_consistency.csv")
        if os.path.exists(cp):
            c = read_csv(cp)
            M.add("att_seed_r", "Attention agreement between seeds", f"{mean(float(x['mean_r']) for x in c):+.3f}",
                  group="attention", note="moderate; show attention across seeds, not from one",
                  source=f"results/{os.path.basename(main)}/attention_seed_consistency.csv")

    else:
        # spec / brief mode
        M.add("gat_vs_gcn", "GAT over GCN, ungauged discharge RMSE", "—", None, "pending",
              "GAT-vs-GCN training not finished", "model", "brief §8")
        M.add("att_tt_r", "Attention vs travel time, hop-stratified r", "—", None, "pending",
              "needs a trained GAT", "attention", "brief §8")

    # ---- ablations
    ab_path = os.path.join(repo, "results", "ablations.csv") if repo else None
    if ab_path and os.path.exists(ab_path) and main:
        prov["runs"].append("ablations.csv")
        rows = read_csv(ab_path)
        ref = next((x for x in rows if x["ablation"].startswith("B1")), None)
        ablations = []

        def pair_cells(run_dir):
            p = os.path.join(repo, "results", run_dir, "metrics_per_seed.csv")
            if not os.path.exists(p):
                return None
            cell = defaultdict(list)
            for x in read_csv(p):
                if x["model"] == "gat" and x["variable"] == "discharge_m3s" and x["node_group"] == "ungauged":
                    cell[(x["basin"], int(x["seed"]))].append(float(x["rmse"]))
            return {k: mean(v) for k, v in cell.items()}

        ref_cells = pair_cells(ref["run"]) if ref else None
        for x in rows:
            rm = float(x["rmse_all"])
            vs = p = better = None
            if x is not ref and ref_cells:
                cells = pair_cells(x["run"])
                if cells:
                    # RESULTS.md convention: mean of per-(basin, seed) relative
                    # change against B1, one-sample t on those changes.
                    keys = sorted(set(cells) & set(ref_cells))
                    rel = [(ref_cells[k] - cells[k]) / ref_cells[k] for k in keys]
                    vs = 100 * mean(rel)
                    p = paired_t_p(rel, [0.0] * len(rel))
                    better = f"{sum(1 for k in keys if cells[k] < ref_cells[k])}/{len(keys)}"
            ablations.append({
                "name": "reference (B1)" if x is ref else x["ablation"],
                "detail": x["detail"],
                "rmse": r(rm, 3), "vsRefPct": r(vs, 2), "p": r(p, 3), "betterIn": better,
                "attnR": r(float(x["attn_r"]), 3),
            })
        und = next((a for a in ablations if a["name"] == "undirected"), None)
        if und:
            M.add("undirected_gain", "Undirected graph vs directed reference", f"+{und['vsRefPct']:.1f}", "%",
                  group="ablation", note=f"p = {und['p']:.3f}, better in {und['betterIn']} pairs — larger than the GAT gain",
                  source="results/ablations.csv")
    elif not main:
        pass

    for id_, label, val, unit, group, note in PENDING_ALWAYS:
        M.add(id_, label, val, unit, "pending", note, group, None)

    return M.items, rollout, basin_cmp, att_basins, ablations, prov


# -------------------------------------------------------------------- emit

NETWORK_TYPES = """
export type NetNode = {
  id: string
  label: string
  branch: string
  pathPosition: number
  /** world units: x along flow, y elevation (exaggerated), z lateral */
  pos: [number, number, number]
  elevationM: number
  channelSlope: number
  channelWidthM: number
  manningN: number
  localAreaKm2: number
  drainageAreaKm2: number
  gauged: boolean
  gaugeRole: string | null
}

export type NetEdge = {
  id: number
  source: string
  target: string
  hops: number
  routing: boolean
  travelTimeHours: number
  reachLengthM: number
  celerityMs: number
  muskingumKHours: number | null
  muskingumX: number | null
  /** variance (h²) of this reach's impulse response under the dataset's own routing */
  dispersionHours2: number | null
}

export type BasinSummary = {
  id: string
  character: string
  celerityMs: number
  manningN: number
  runoffCoefficient: number
  nodes: number
  edges: number
  routingEdges: number
  tributaries: number
  gauged: number
}

export type AttentionExport = {
  run: string
  layer: string
  seeds: number
  steps: number
  /** [rolloutStep][edgeId], mean over seeds */
  mean: number[][]
  low: number[][]
  high: number[][]
} | null

export type ProblemHydrograph = {
  upstream: { id: string; label: string; role: string | null }
  downstream: { id: string; label: string; role: string | null }
  reaches: number
  pathTravelHours: number
  hours: number[]
  recordedUpstream: number[]
  recordedDownstream: number[]
  routedUpstreamOnly: number[]
}

export type ModelWindow = {
  originIndex: number
  inputSteps: number
  rolloutSteps: number
  series: Record<string, number[]>
}
"""

RESULTS_TYPES = """
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
"""


def write_ts(path, header, body):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
        fh.write(body)
    print("wrote", os.path.relpath(path, SITE))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("repo", nargs="?", default=os.path.join(SITE, "..", "Machine Learning Project"),
                    help="thesis repo path (default: ../Machine Learning Project)")
    ap.add_argument("--basin", default="basin_01")
    args = ap.parse_args()
    repo = os.path.abspath(args.repo)
    when = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")

    ds = os.path.join(repo, "flood_routing_dataset")
    have = all(os.path.exists(os.path.join(ds, f)) for f in ("nodes.csv", "edges.csv"))
    os.makedirs(OUT_DIR, exist_ok=True)

    if have:
        mode = "thesis-repo"
        net = build_network_from_thesis(repo, args.basin)
        source = repo.replace("\\", "/")
        if os.path.exists(os.path.join(ds, "timeseries.csv")):
            series, _ = extract_events(repo, net)
        else:
            series = synth_event(net)
    else:
        mode = "seeded-spec"
        print(f"[generate_data] no dataset CSVs under {ds}; using the seeded spec (brief §6.1)")
        net = build_network_from_spec()
        source = "brief §6.1 seeded spec + §8 verified numbers"
        series = synth_event(net)

    up, down, i0 = pick_event(net, series)
    hydro = problem_hydrograph(net, series, up, down, i0)
    window = model_window(net, series, i0)
    runs = find_runs(repo) if have else []
    main_run, _ = pick_main_run(runs) if runs else (None, False)
    attention = attention_for(main_run, net) if main_run else None

    body = NETWORK_TYPES + "\n"
    body += f"export const basinId = {json.dumps(net['basinId'])}\n"
    body += f"export const basinCharacter = {json.dumps(net['character'])}\n"
    body += f"export const confluenceId = {json.dumps(confluence_id(net))}\n\n"
    body += f"export const nodes: NetNode[] = {ts_literal(net['nodes'])}\n\n"
    body += f"export const edges: NetEdge[] = {ts_literal(net['edges'])}\n\n"
    body += f"export const basins: BasinSummary[] = {ts_literal(net['basins'])}\n\n"
    body += f"export const attention: AttentionExport = {ts_literal(attention)}\n\n"
    body += f"export const problemHydrograph: ProblemHydrograph = {ts_literal(hydro)}\n\n"
    body += f"export const modelWindow: ModelWindow = {ts_literal(window)}\n"
    write_ts(os.path.join(OUT_DIR, "network.ts"), HEADER.format(when=when, mode=mode, source=source), body)

    metrics, rollout, cmp_, att_b, abl, prov = build_results(repo if have else None, net, mode)
    body = RESULTS_TYPES + "\n"
    body += f"export const provenance: {{ mode: string; runs: string[] }} = {ts_literal(prov)}\n\n"
    body += f"export const metrics: Metric[] = {ts_literal(metrics)}\n\n"
    body += f"export const rollout: Rollout = {ts_literal(rollout)}\n\n"
    body += f"export const basinComparison: BasinComparison = {ts_literal(cmp_)}\n\n"
    body += f"export const attentionByBasin: AttentionByBasin = {ts_literal(att_b)}\n\n"
    body += f"export const ablations: Ablation[] | null = {ts_literal(abl)}\n"
    write_ts(os.path.join(OUT_DIR, "results.ts"), HEADER.format(when=when, mode=mode, source=source), body)

    pend = [m["id"] for m in metrics if m["status"] == "pending"]
    print(f"[generate_data] mode={mode} nodes={len(net['nodes'])} edges={len(net['edges'])} "
          f"attention={'yes' if attention else 'no'} metrics={len(metrics)} pending={len(pend)}")
    if pend:
        print("  pending:", ", ".join(pend))


if __name__ == "__main__":
    main()
