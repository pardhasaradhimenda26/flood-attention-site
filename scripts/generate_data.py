#!/usr/bin/env python3
"""
generate_data.py — emit src/data/network.ts and src/data/results.ts.

Standalone: Python 3.9+ standard library only. No numpy, no pandas, no site
dependencies. Both output files are generated; never hand-edit them.

    python scripts/generate_data.py                      # ../Machine Learning Project
    python scripts/generate_data.py "D:/thesis/repo"     # explicit path
    python scripts/generate_data.py --basin basin_03     # hero/attention basin
    python scripts/generate_data.py --results-only       # npm run regen-data

Two stages.

1. Sync (needs the thesis repo). Copies every input results.ts depends on into
   provenance/ — RESULTS.md, the dataset's node/edge/basin tables, and for each
   run its run.json, config.yaml and metric CSVs — and writes
   provenance/MANIFEST.json with run IDs, config hashes, the dataset version
   and a SHA-256 for every file. network.ts is written in this stage too, since
   it needs timeseries.csv and attention.npz, which are too large to commit.

2. Results (needs only provenance/). Every number in results.ts is computed
   from, or read out of, the committed files. --results-only runs this stage
   alone and is byte-for-byte reproducible: no timestamps, seeded bootstrap.

Every metric carries:
    status      'verified'  measured, reproducible from provenance/
                'qualified' measured, with a limitation stated in `qualifier`
                'pending'   not measured
    derivation  'recomputed' from raw outputs here, or 'read' from RESULTS.md
    run         the run ID behind it (or the script and dataset version, for
                model-free tests that write no run directory), and configHash
    interval    for comparisons: 95% percentile interval from a clustered
                bootstrap that resamples basins and seeds, not (basin, seed)
                pairs, because pairs that share a basin or a seed are not
                independent

A recorded constant that no longer appears in RESULTS.md becomes 'pending'.
If the dataset CSVs are absent, network.ts falls back to the seeded spec in the
site brief (section 6.1); results.ts still comes from provenance/.
"""

import argparse
import ast
import csv
import datetime as _dt
import hashlib
import json
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import zipfile
from array import array
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT_DIR = os.path.join(SITE, "src", "data")
PROV = os.path.join(SITE, "provenance")

HEADER = """// GENERATED FILE — DO NOT HAND-EDIT.
// Written by scripts/generate_data.py on {when}.
// Mode: {mode}. Source: {source}
// Re-run the script to update. Any manual change here is overwritten.
"""

RESULTS_HEADER = """// GENERATED FILE — DO NOT HAND-EDIT.
// Written by scripts/generate_data.py from the committed inputs in provenance/
// (MANIFEST.json sha256 {digest}). Reproduce with: npm run regen-data
// Any manual change here is overwritten, and CI fails if this file drifts.
"""

BOOT_DRAWS = 10000
BOOT_SEED = 20260830


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
    """Real timeseries for every node of the basin: discharge, precipitation,
    water depth and velocity, hour by hour."""
    path = os.path.join(repo, "flood_routing_dataset", "timeseries.csv")
    basin = net["basinId"]
    series = defaultdict(list)
    rec = {"rain": defaultdict(list), "depth": defaultdict(list), "velocity": defaultdict(list)}
    with open(path, newline="", encoding="utf-8") as fh:
        rd = csv.reader(fh)
        h = next(rd)
        ix = {k: i for i, k in enumerate(h)}
        for row in rd:
            if row[ix["basin_id"]] != basin:
                continue
            nid = row[ix["node_id"]]
            series[nid].append(float(row[ix["discharge_m3s"]]))
            rec["rain"][nid].append(float(row[ix["precipitation_mm"]]))
            rec["depth"][nid].append(float(row[ix["water_depth_m"]]))
            rec["velocity"][nid].append(float(row[ix["velocity_ms"]]))
    return series, rec


STORM_LEAD_H = 12      # hours shown before the rain starts
STORM_HOURS = 140      # hours shown in total
STORM_DRY_AFTER = 80   # hours after the storm ends before the next one may start, so its response is not mixed with the next


def pick_storm(net, series, rec):
    """The hero's storm: a real event from the record, chosen by rule.

    Storms are runs of hours with basin rain above a threshold. Eligible storms
    put at least half their rain on the four highest main-stem cross-sections
    (upstream-dominated) and are followed by STORM_DRY_AFTER hours before the
    next storm. Of those, the one with the most upstream rain is shown.
    """
    ids = [n["id"] for n in net["nodes"]]
    main = sorted((n for n in net["nodes"] if n["branch"] == "main"), key=lambda n: n["pathPosition"])
    up_ids = [n["id"] for n in main[:4]]
    rain = rec["rain"]
    T = len(rain[ids[0]])
    tot = [sum(rain[i][t] for i in ids) for t in range(T)]
    upr = [sum(rain[i][t] for i in up_ids) for t in range(T)]
    storms, t = [], 0
    while t < T:
        if tot[t] > 2.0:
            s = t
            while t < T and tot[t] > 0.5:
                t += 1
            storms.append((s, t))
        t += 1
    best = None
    for k, (s, e) in enumerate(storms):
        nxt = storms[k + 1][0] if k + 1 < len(storms) else T
        U, A = sum(upr[s:e]), sum(tot[s:e])
        if A <= 0 or U / A < 0.5 or nxt - e < STORM_DRY_AFTER or s - STORM_LEAD_H < 0 or s - STORM_LEAD_H + STORM_HOURS > T:
            continue
        if best is None or U > best[2]:
            best = (s, e, U)
    if best is None:
        return None
    lo = best[0] - STORM_LEAD_H
    hi = lo + STORM_HOURS
    gauges = sorted((n for n in net["nodes"] if n["gauged"]), key=lambda n: n["pathPosition"] + (0 if n["branch"] == "main" else 0.001))
    outlet = main[-1]["id"]
    gauge_set = {g["id"] for g in gauges}
    basin_rain = [r(sum(rain[i][t] for i in ids) / len(ids), 3) for t in range(lo, hi)]
    up_rain = [sum(rain[i][t] for i in up_ids) / len(up_ids) for t in range(lo, hi)]
    rain_peak = max(range(len(up_rain)), key=lambda k: up_rain[k])
    out_depth = rec["depth"][outlet][lo:hi]
    out_peak = max(range(len(out_depth)), key=lambda k: out_depth[k])
    return {
        "recordStartHour": lo,
        "hours": STORM_HOURS,
        "rule": f"largest upstream-dominated storm in {net['basinId']} followed by {STORM_DRY_AFTER} h without another storm",
        "upstreamIds": up_ids,
        "outletId": outlet,
        "gaugeIds": [g["id"] for g in gauges],
        "basinRainMm": basin_rain,
        "upstreamRainPeakHour": rain_peak,
        "outletPeakHour": out_peak,
        "lagHours": out_peak - rain_peak,
        # Discharge only where a gauge would read it; depth, rain and velocity everywhere.
        "nodes": {nid: {
            "rainMm": [r(v, 2) for v in rain[nid][lo:hi]],
            "depthM": [r(v, 3) for v in rec["depth"][nid][lo:hi]],
            "velocityMs": [r(v, 2) for v in rec["velocity"][nid][lo:hi]],
            **({"dischargeM3s": [r(v, 2) for v in series[nid][lo:hi]]} if nid in gauge_set else {}),
        } for nid in ids},
    }


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


# ------------------------------------------------------------- provenance
# Stage 1 copies inputs out of the thesis repo; stage 2 reads only these.

WEEK4_RUNS = [
    # Named in RESULTS.md Week 4 as the source of its numbers.
    "20260830-145849-092b9d652a",            # headline, 3 seeds
    "20260830-150156-cd34e687df-robustness",  # 8-seed robustness
    "20260830-150740-092b9d652a-repro",       # reproducibility re-run
]
RUN_FILES = ["run.json", "config.yaml", "metrics.csv", "metrics_per_seed.csv",
             "attention_scores.csv", "attention_seed_consistency.csv"]
DATASET_FILES = ["nodes.csv", "edges.csv", "basins.csv"]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_head(repo):
    try:
        out = subprocess.run(["git", "-C", repo, "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def sync_provenance(repo):
    """Copy every input results.ts needs into provenance/ and write MANIFEST.json."""
    runs_all = find_runs(repo)
    main, _ = pick_main_run(runs_all)
    if not main:
        raise SystemExit("no run with persistence, MLP and GCN under results/")
    ab_csv = os.path.join(repo, "results", "ablations.csv")
    abl_ids = [x["run"] for x in read_csv(ab_csv)] if os.path.exists(ab_csv) else []
    wanted = [(os.path.basename(main), "main")]
    wanted += [(r_, "ablation") for r_ in abl_ids if r_ != os.path.basename(main)]
    wanted += [(r_, "week4") for r_ in WEEK4_RUNS]

    if os.path.isdir(PROV):
        shutil.rmtree(PROV)
    os.makedirs(os.path.join(PROV, "runs"))
    os.makedirs(os.path.join(PROV, "dataset"))

    def copy(src, rel):
        dst = os.path.join(PROV, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        # Normalise line endings so the committed copy hashes the same on every OS.
        with open(src, "rb") as fh:
            data = fh.read().replace(b"\r\n", b"\n")
        with open(dst, "wb") as fh:
            fh.write(data)

    copy(os.path.join(repo, "RESULTS.md"), "RESULTS.md")
    if os.path.exists(ab_csv):
        copy(ab_csv, "ablations.csv")
    ds = os.path.join(repo, "flood_routing_dataset")
    for f in DATASET_FILES:
        copy(os.path.join(ds, f), f"dataset/{f}")

    runs = []
    for run_id, role in wanted:
        src = os.path.join(repo, "results", run_id)
        if not os.path.isdir(src):
            print(f"  [sync] run {run_id} missing; skipped")
            continue
        for f in RUN_FILES:
            if os.path.exists(os.path.join(src, f)):
                copy(os.path.join(src, f), f"runs/{run_id}/{f}")
        with open(os.path.join(src, "run.json"), encoding="utf-8") as fh:
            meta = json.load(fh)
        runs.append({
            "id": run_id, "role": role, "configHash": meta.get("config_hash"),
            "configPath": meta.get("config_path"), "seeds": meta.get("seeds"),
            "models": meta.get("models"), "python": meta.get("python"), "torch": meta.get("torch"),
        })

    # Dataset version: content hash of all four tables, timeseries included,
    # so a regenerated dataset is a different version even if the graph is not.
    ds_hashes = {f: sha256_file(os.path.join(ds, f)) for f in DATASET_FILES + ["timeseries.csv"]}
    ds_version = hashlib.sha256("".join(ds_hashes[k] for k in sorted(ds_hashes)).encode()).hexdigest()[:10]
    gen = os.path.join(repo, "data", "generate_flood_dataset.py")

    files = {}
    for root, _, names in os.walk(PROV):
        for n in sorted(names):
            p = os.path.join(root, n)
            rel = os.path.relpath(p, PROV).replace("\\", "/")
            if rel != "MANIFEST.json":
                files[rel] = sha256_file(p)
    manifest = {
        "about": "Inputs behind src/data/results.ts. Copied from the thesis repository by "
                 "scripts/generate_data.py; reproduce results.ts with `npm run regen-data`.",
        "thesisCommit": git_head(repo),
        "dataset": {
            "version": ds_version,
            "generator": "data/generate_flood_dataset.py",
            "generatorSha256": sha256_file(gen) if os.path.exists(gen) else None,
            "files": ds_hashes,
            "note": "timeseries.csv is not committed (54 MB); its hash pins the version.",
        },
        "runs": runs,
        "files": dict(sorted(files.items())),
    }
    with open(os.path.join(PROV, "MANIFEST.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"synced provenance/: {len(runs)} runs, {len(files)} files, dataset {ds_version}")


def load_manifest():
    p = os.path.join(PROV, "MANIFEST.json")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def check_manifest(manifest):
    """Refuse to build from inputs that differ from what the manifest pins."""
    bad = []
    for rel, digest in manifest["files"].items():
        p = os.path.join(PROV, rel)
        if not os.path.exists(p) or sha256_file(p) != digest:
            bad.append(rel)
    if bad:
        raise SystemExit("provenance/ does not match MANIFEST.json: " + ", ".join(bad))


# ------------------------------------------------------ clustered bootstrap
# (basin, seed) cells share basins and seeds, so they are not 24 independent
# samples. Resample basins and seeds independently, with replacement, and
# recompute the statistic on the crossed resample. Seeded and using only
# random(), which is stable across Python versions and platforms.

def boot_interval(stat, basins, seeds, draws=BOOT_DRAWS, seed=BOOT_SEED):
    rng = random.Random(seed)
    nb, ns = len(basins), len(seeds)
    out = []
    for _ in range(draws):
        bs = [basins[int(rng.random() * nb)] for _ in range(nb)]
        ss = [seeds[int(rng.random() * ns)] for _ in range(ns)] if ns else []
        v = stat(bs, ss)
        if v is not None and math.isfinite(v):
            out.append(v)
    out.sort()
    n = len(out)
    lo, hi = out[int(0.025 * n)], out[min(n - 1, int(math.ceil(0.975 * n)) - 1)]
    return lo, hi


def interval(lo, hi, nb, ns, what="basins and seeds"):
    method = (f"clustered bootstrap, {BOOT_DRAWS} draws resampling {nb} basins"
              + (f" and {ns} seeds" if ns else "") + " with replacement; percentile")
    return {"lo": r(lo, 3), "hi": r(hi, 3), "level": 0.95, "method": method}


def fmt_ci(iv, unit=""):
    def s(v):
        return ("+" if v > 0 else "−" if v < 0 else "") + f"{abs(v):.1f}" + unit
    return f"95% interval {s(iv['lo'])} to {s(iv['hi'])}"


def fmt_ci_r(iv):
    def s(v):
        return ("+" if v > 0 else "−" if v < 0 else "") + f"{abs(v):.3f}"
    return f"95% interval {s(iv['lo'])} to {s(iv['hi'])}"


def unpaired_seed_interval(a, b, stat, draws=BOOT_DRAWS, seed=BOOT_SEED):
    """Two independent groups of seeds (Week 4: separate models, no pairing)."""
    rng = random.Random(seed)
    out = []
    for _ in range(draws):
        ra = [a[int(rng.random() * len(a))] for _ in a]
        rb = [b[int(rng.random() * len(b))] for _ in b]
        out.append(stat(ra, rb))
    out.sort()
    n = len(out)
    return out[int(0.025 * n)], out[min(n - 1, int(math.ceil(0.975 * n)) - 1)]


# ---------------------------------------------------------------- results

class Metrics:
    def __init__(self):
        self.items = []

    def add(self, id, label, value, unit=None, status="verified", *, group, derivation, source=None,
            run=None, config_hash=None, qualifier=None, note=None, interval=None, supersedes=None):
        if status == "qualified" and not qualifier:
            raise ValueError(f"{id}: a qualified metric needs its qualifier")
        m = {"id": id, "label": label, "value": value, "status": status, "group": group,
             "derivation": derivation}
        for k, v in (("unit", unit), ("qualifier", qualifier), ("note", note), ("source", source),
                     ("run", run), ("configHash", config_hash), ("interval", interval),
                     ("supersedes", supersedes)):
            if v is not None:
                m[k] = v
        self.items.append(m)


def results_md_has(needle):
    p = os.path.join(PROV, "RESULTS.md")
    if not os.path.exists(p):
        return False
    with open(p, encoding="utf-8") as fh:
        return needle in fh.read()


MAIN = "20260830-192452-1440f965dd-main"
W4 = "20260830-145849-092b9d652a"
W4_ROBUST = "20260830-150156-cd34e687df-robustness"
W4_REPRO = "20260830-150740-092b9d652a-repro"
GATE_SCRIPT = "evaluation/gate_information_test.py"
INFO_SCRIPT = "evaluation/graph_information_test.py"
EVAL_TESTS = "evaluation/test_attention_eval.py"
DATASET = "dataset"  # placeholder resolved to "flood_routing_dataset@<version>"

# Recorded constants: numbers printed by scripts rather than written to CSVs.
# Each is read out of the committed RESULTS.md: the needle is the exact text
# the document carries, and the value shown is that text, rounded at most.
# A recorded constant whose needle disappears from RESULTS.md turns pending.
#
# Fields: id, label, value, unit, group, needle, section, run, status, qualifier, note
RECORDED = [
    ("real_sections", "Real network: surveyed cross-sections", 28, None, "real", "4 of 28", "W5.1 A1", None, "verified", None, "H1–H4 network; a property of the river, not a result"),
    ("real_gauges", "Real network: gauges", 4, None, "real", "4 of 28", "W5.1 A1", None, "verified", None, "H1–H4"),
    ("real_ungauged", "Real network: cross-sections without a gauge", 86, "%", "real", "4 of 28", "W5.1 A1", None, "verified", None, "24 of 28"),
    ("repro", "Reproducibility re-run of the Week 4 headline table", "identical", None, "rigor", "reproduced the headline table", "Week 4 §8", W4_REPRO, "verified", None, "to four decimal places, after all code changes"),
    ("mass_balance", "Mass balance, all basins", "1.0000", None, "dataset", "1.0000 in all 8 basins", "W5.1 A5", DATASET, "verified", None, None),
    ("storm_kernel", "Storm kernel width (2-D Gaussian)", 0.18, None, "dataset", "width 0.18", "W5.1 A2", DATASET, "verified", None, "over along-flow position and branch offset"),
    ("dry_rise", "Rising node-hours under dry sky", 12.0, "%", "dataset", "**12.0%**", "W5.1 A2", DATASET, "verified", None, "samples local forcing cannot explain"),
    ("w4_own_r2", "Own 24-step history, R² at 1 h", 0.9998, None, "week4", "0.9998", "Week 4 §4b", INFO_SCRIPT, "verified", None, "least squares, out of sample"),
    ("w4_gain_1h", "Mean R² gain from upstream history, 1 h", "+0.0001", None, "week4", "**+0.0001**", "Week 4 §4b", INFO_SCRIPT, "verified", None, None),
    ("w4_gain_6h", "Mean R² gain from upstream history, 6 h", "+0.0045", None, "week4", "+0.0045", "Week 4 §4b", INFO_SCRIPT, "verified", None, None),
    ("w4_gain_12h", "Mean R² gain from upstream history, 12 h", "−0.0144", None, "week4", "−0.0144", "Week 4 §4b", INFO_SCRIPT, "verified", None, None),
    ("w4_gcn_variability", "GCN seed spread relative to the MLP's, held-out basin", "2–4×", None, "week4", "four times more variable", "Week 4 §3", W4, "verified", None, "s.d. across seeds"),
    ("gate_all", "Gate ΔR², all ungauged nodes", "+0.181", None, "gate", "+0.1809", "W5.2", GATE_SCRIPT, "qualified", "below the pass mark in basin_08; positive in 7 of 8 basins", "pass mark 0.05; model-free ridge test"),
    ("gate_served", "Gate ΔR², ungauged nodes with a gauged ancestor", "+0.242", None, "gate", "+0.2416", "W5.2", GATE_SCRIPT, "verified", None, "positive in 8 of 8 basins"),
    ("gate_k1", "Gate ΔR² at lead 1 h", "+0.236", None, "gate", "+0.2363", "W5.2", GATE_SCRIPT, "verified", None, None),
    ("gate_k6", "Gate ΔR² at lead 6 h", "+0.241", None, "gate", "+0.2411", "W5.2", GATE_SCRIPT, "verified", None, None),
    ("gate_k12", "Gate ΔR² at lead 12 h", "+0.247", None, "gate", "+0.2474", "W5.2", GATE_SCRIPT, "verified", None, None),
    ("gate_b08", "basin_08, all ungauged nodes", "−0.005", None, "gate", "**−0.005**", "W5.2", GATE_SCRIPT, "verified", None, "10 of 26 ungauged nodes have no gauged ancestor"),
    ("gate_b08_served", "basin_08, served nodes only", "+0.012", None, "gate", "**+0.012**", "W5.2", GATE_SCRIPT, "verified", None, None),
    ("gate_coverage", "Ungauged nodes with a gauged ancestor in 9 hops", 63, "%", "gate", "126 of 201 ungauged nodes (63%)", "W5.2", GATE_SCRIPT, "verified", None, "126 of 201"),
    ("trap_untrained", "Plain within-node r, untrained GATv2", 0.956, None, "attention", "**0.956**", "W5.5", EVAL_TESTS, "verified", None, "the false headline the metric would have produced"),
    ("trap_confound", "Within-node r(reach length, travel time)", "+0.97 to +0.99", None, "attention", "+0.97 to +0.99", "W5.5", DATASET, "verified", None, "hop count drives both"),
    ("ref_routing", "Naive cross-correlation reference, routing edges", 0.698, None, "attention", "r = 0.698", "W5.1 A5", MAIN, "verified", None, "re-derived on the Week 5 dataset; also in the run's config.yaml"),
    ("ref_all", "Naive cross-correlation reference, all message edges", 0.769, None, "attention", "r = 0.769", "W5.1 A5", MAIN, "verified", None, None),
    ("att_local_area", "Attention vs upstream local area", "+0.870", None, "attention", "+0.870", "W5.5", MAIN, "verified", None, "sign-consistent in 8 of 8 basins"),
    ("att_mean_q", "Attention vs upstream mean discharge", "+0.845", None, "attention", "+0.845", "W5.5", MAIN, "verified", None, "significant in 8 of 8"),
    ("att_drainage", "Attention vs upstream drainage area", "+0.844", None, "attention", "+0.844", "W5.5", MAIN, "verified", None, "significant in 8 of 8"),
    ("att_reach", "Attention vs reach length", "+0.062", None, "attention", "+0.062", "W5.5", MAIN, "verified", None, "5 of 8 basins"),
    ("tests_passing", "Passing tests on the attention evaluator", 33, None, "rigor", "33 passing", "W5.5", EVAL_TESTS, "verified", None, None),
    ("undir_coverage_r", "Undirected gain vs upstream gauge coverage, r", "−0.06", None, "ablation", "**−0.06**", "W5.6", "20260831-192438-b9b97f5d57-abl_undirected", "verified", None, "the obvious mechanism fails"),
]

# Things nobody has measured yet. Always pending until a real run exists.
PENDING_ALWAYS = [
    ("real_gat_rmse", "GAT ungauged RMSE on H1–H4 gauge data", "—", "m³/s", "real", "Real network: 4 gauges, 28 cross-sections. Not yet run."),
    ("real_gat_vs_gcn", "GAT vs GCN on H1–H4 gauge data", "—", "%", "real", "Synthetic results do not transfer automatically."),
    ("temporal_att_tt", "Temporal attention vs travel time, step by step", "—", "r", "real", "Next experiment: lag may appear on the temporal axis, not the spatial one."),
    ("undir_mechanism", "Why the undirected graph helps", "—", None, "real", "Effect measured; mechanism unconfirmed."),
]


def run_dir(run_id):
    return os.path.join(PROV, "runs", run_id)


def prov_rel(run_id, f):
    return f"provenance/runs/{run_id}/{f}"


def cells_from(run_id, model, group="ungauged"):
    """Mean ungauged discharge RMSE over the 12 rollout steps, per (basin, seed)."""
    p = os.path.join(run_dir(run_id), "metrics_per_seed.csv")
    if not os.path.exists(p):
        return None, {}
    cell, split = defaultdict(list), {}
    for x in read_csv(p):
        if x["model"] == model and x["variable"] == "discharge_m3s" and x.get("node_group", "all") == group:
            cell[(x["basin"], int(x["seed"]))].append(float(x["rmse"]))
            split[x["basin"]] = x["split"]
    return ({k: mean(v) for k, v in cell.items()} or None), split


def pooled_improvement(a_cells, b_cells):
    """100 · (B − A) / B on means pooled over the given cells: positive = A better."""
    def stat(bs, ss):
        a = mean(a_cells[(b, s)] for b in bs for s in ss)
        c = mean(b_cells[(b, s)] for b in bs for s in ss)
        return 100 * (c - a) / c
    return stat


def mean_pair_change(a_cells, ref_cells):
    """RESULTS.md ablation convention: mean of per-(basin, seed) relative change vs reference."""
    def stat(bs, ss):
        return 100 * mean((ref_cells[(b, s)] - a_cells[(b, s)]) / ref_cells[(b, s)] for b in bs for s in ss)
    return stat


def build_results(manifest):
    M = Metrics()
    runs = {x["id"]: x for x in manifest["runs"]} if manifest else {}
    ds_version = manifest["dataset"]["version"] if manifest else None

    def hash_of(run_id):
        if run_id in runs:
            return runs[run_id]["configHash"]
        return None

    def run_label(run_id):
        if run_id == DATASET:
            return f"flood_routing_dataset@{ds_version}"
        if run_id and run_id.startswith("evaluation/"):
            # Model-free scripts write no run directory: name the script and
            # the dataset version it ran on.
            return f"{run_id} on dataset {ds_version}"
        return run_id

    def cfg_of(run_id):
        if run_id == DATASET or (run_id and run_id.startswith("evaluation/")):
            return ds_version
        return hash_of(run_id)

    # ---- dataset counts, recomputed from the committed tables
    dsd = os.path.join(PROV, "dataset")
    if os.path.exists(os.path.join(dsd, "nodes.csv")):
        nodes = read_csv(os.path.join(dsd, "nodes.csv"))
        edges = read_csv(os.path.join(dsd, "edges.csv"))
        basins = {n["basin_id"] for n in nodes}
        g = sum(truthy(n["is_gauged"]) for n in nodes)
        routing = [e for e in edges if truthy(e["is_routing_edge"])]
        tt = mean(float(e["travel_time_hours"]) for e in routing)
        kw = dict(group="dataset", derivation="recomputed", source="provenance/dataset/*.csv",
                  run=run_label(DATASET), config_hash=ds_version)
        M.add("basins", "Basins", len(basins), **kw)
        M.add("nodes", "Cross-section nodes", len(nodes), **kw)
        M.add("edges", "Directed edges", len(edges), note=f"{len(routing)} routing + {len(edges) - len(routing)} message-only (2–3 hops)", **kw)
        M.add("gauged", "Gauged nodes", g, **kw)
        M.add("gauged_pct", "Share of nodes gauged", r(100 * g / len(nodes), 1), "%", **kw)
        M.add("mean_tt", "Mean 1-hop travel time", r(tt, 2), "h", **kw)
        M.add("horizon_ratio", "Rollout horizon / mean travel time", r(12 / tt, 2), "×", note="12-step rollout", **kw)

    # ---- recorded constants, read from the committed RESULTS.md
    for id_, label, val, unit, group, needle, section, run_id, status, qual, note in RECORDED:
        found = results_md_has(needle)
        M.add(id_, label, val if found else "—", unit, status if found else "pending", group=group,
              derivation="read", source=f"provenance/RESULTS.md §{section}",
              run=run_label(run_id), config_hash=cfg_of(run_id),
              qualifier=qual if found else None,
              note=note if found else f"not found in RESULTS.md ({section}); re-check before publishing")

    # ---- Week 4: GCN vs MLP, recomputed from the 8-seed robustness run.
    # Separate models with no pairing, so seeds are resampled per model.
    p = os.path.join(run_dir(W4_ROBUST), "metrics_per_seed.csv")
    if os.path.exists(p):
        per = defaultdict(list)
        for x in read_csv(p):
            if x["variable"] == "discharge_m3s":
                per[(x["model"], x["basin"], int(x["seed"]))].append(float(x["rmse"]))

        def seeds_of(model, basin):
            return [mean(v) for (m_, b_, s_), v in sorted(per.items()) if m_ == model and b_ == basin]

        def imp(gcn, mlp):
            return 100 * (mean(mlp) - mean(gcn)) / mean(mlp)

        src = prov_rel(W4_ROBUST, "metrics_per_seed.csv")
        for id_, basin, label, status, qual in [
            ("w4_gcn_win", "basin_02", "GCN over MLP, the one basin it won", "qualified",
             "one basin of three; 8 seeds"),
            ("w4_gcn_held", "basin_03", "GCN vs MLP, held-out basin", "qualified",
             "8 seeds; interval spans zero"),
        ]:
            g_, m_ = seeds_of("gcn", basin), seeds_of("mlp", basin)
            lo, hi = unpaired_seed_interval(g_, m_, imp)
            iv = {"lo": r(lo, 3), "hi": r(hi, 3), "level": 0.95,
                  "method": f"bootstrap over {len(g_)} seeds per model, {BOOT_DRAWS} draws; percentile"}
            M.add(id_, label, f"{imp(g_, m_):+.1f}", "%", status, group="week4", derivation="recomputed",
                  source=src, run=W4_ROBUST, config_hash=hash_of(W4_ROBUST),
                  qualifier=f"{qual}; {fmt_ci(iv, '%')}", interval=iv, note=f"{basin}; positive = GCN better")

    # ---- main run
    rollout = basin_cmp = att_basins = ablations = None
    gat, split = cells_from(MAIN, "gat")
    gcn, _ = cells_from(MAIN, "gcn")
    mlp, _ = cells_from(MAIN, "mlp")
    per_c, _ = cells_from(MAIN, "persistence")
    mcsv = os.path.join(run_dir(MAIN), "metrics.csv")

    if os.path.exists(mcsv):
        rows = read_csv(mcsv)
        models = ["persistence", "mlp", "gcn", "gat"]
        steps = sorted({int(x["rollout_step"]) for x in rows})
        rollout = {"variable": "discharge_m3s", "unit": "m³/s", "steps": steps, "run": MAIN,
                   "configHash": hash_of(MAIN), "panels": {}}
        for grp in ("gauged", "ungauged"):
            panel = []
            for m in models:
                sel = [x for x in rows if x["model"] == m and x["variable"] == "discharge_m3s" and x["node_group"] == grp]
                if not sel:
                    panel.append({"model": m, "status": "pending", "values": []})
                    continue
                vals = [r(mean(float(x["rmse_mean"]) for x in sel if int(x["rollout_step"]) == s), 4) for s in steps]
                panel.append({"model": m, "status": "verified", "values": vals})
            rollout["panels"][grp] = panel

    if gat and gcn:
        src = prov_rel(MAIN, "metrics_per_seed.csv")
        kw = dict(derivation="recomputed", source=src, run=MAIN, config_hash=hash_of(MAIN))
        basins_ = sorted({b for b, _ in gat})
        seeds = sorted({s for _, s in gat})
        held = [b for b in basins_ if split[b] == "held_out"]
        nb, ns = len(basins_), len(seeds)

        # Held-out basins: their own group, never folded into the figure above.
        hstat = pooled_improvement(gat, gcn)
        hpoint = hstat(held, seeds)
        hlo, hhi = boot_interval(hstat, held, seeds)
        hiv = interval(hlo, hhi, len(held), ns)
        gh = [mean(gat[(b, s)] for b in held) for s in seeds]
        ch = [mean(gcn[(b, s)] for b in held) for s in seeds]
        M.add("gat_vs_gcn_held", "GAT over GCN, held-out basins only", f"{hpoint:+.2f}", "%", "qualified",
              group="heldout",
              qualifier=f"{fmt_ci(hiv, '%')}; {len(held)} basins, {ns} seeds"
                        + ("; interval spans zero" if hlo <= 0 < hhi else ""),
              note=", ".join(held) + " were never trained on", interval=hiv,
              supersedes=f"paired t over {ns} seed means, p = {paired_t_p(ch, gh):.3f}", **kw)
        M.add("gat_rmse_held", "GAT ungauged RMSE, held-out basins", r(mean(gh), 3), "m³/s", group="heldout", **kw)
        M.add("gcn_rmse_held", "GCN ungauged RMSE, held-out basins", r(mean(ch), 3), "m³/s", group="heldout", **kw)

        stat = pooled_improvement(gat, gcn)
        point = stat(basins_, seeds)
        lo, hi = boot_interval(stat, basins_, seeds)
        iv = interval(lo, hi, nb, ns)
        gat_s = [mean(gat[(b, s)] for b in basins_) for s in seeds]
        gcn_s = [mean(gcn[(b, s)] for b in basins_) for s in seeds]
        survives = lo > 0
        M.add("gat_vs_gcn", "GAT over GCN, ungauged discharge RMSE", f"{point:+.2f}", "%", "qualified", group="model",
              qualifier=(f"{fmt_ci(iv, '%')}, {ns} seeds × {nb} basins; held-out basins alone {hpoint:+.2f}%"
                         + (", interval spans zero" if hlo <= 0 < hhi else f", {fmt_ci(hiv, '%')}")),
              note="pooled over all 8 basins, including the 2 held out; positive = GAT better", interval=iv,
              supersedes=(f"paired t over {ns} seed means, p = {paired_t_p(gcn_s, gat_s):.3f}. Replaced: "
                          + ("the clustered interval excludes zero, so the direction holds"
                             if survives else "the clustered interval includes zero, so the gain is not established")),
              **kw)
        M.add("gat_rmse", "GAT ungauged RMSE, 8-basin mean", r(mean(gat_s), 3), "m³/s", group="model", **kw)
        M.add("gcn_rmse", "GCN ungauged RMSE, 8-basin mean", r(mean(gcn_s), 3), "m³/s", group="model", **kw)

        pairs = [(gcn[(b, s)], gat[(b, s)]) for b in basins_ for s in seeds]
        wins = sum(1 for c, a in pairs if a < c)
        rel = [(c - a) / c for c, a in pairs]
        M.add("gat_pair_wins", "Basin–seed pairs where GAT beats GCN", f"{wins} / {len(pairs)}", None, "qualified",
              group="model", qualifier="pairs share basins and seeds, so this is not 24 independent wins",
              supersedes=f"one-sample t over {len(pairs)} pairs as if independent, p = {paired_t_p(rel, [0.0] * len(rel)):.1e}",
              **kw)
        won = sum(1 for b in basins_ if mean(gat[(b, s)] for s in seeds) < mean(gcn[(b, s)] for s in seeds))
        M.add("gat_basins_won", "Basins where GAT's 3-seed mean beats GCN's", f"{won} / {nb}", group="model",
              note="by up to 18% in some basins and under 1% in others", **kw)
        if mlp:
            ms = pooled_improvement(gat, mlp)
            mlo, mhi = boot_interval(ms, basins_, seeds)
            miv = interval(mlo, mhi, nb, ns)
            M.add("gat_vs_mlp", "GAT over graph-blind MLP, ungauged", f"{ms(basins_, seeds):+.1f}", "%", group="model",
                  note=fmt_ci(miv, "%"), interval=miv, **kw)

        # Per-basin table. Uncertainty per basin is the range over its 3 seeds:
        # with three values a bootstrap would only restate them.
        def seed_sd(cells, b):
            v = [cells[(b, s)] for s in seeds]
            mu = mean(v)
            return math.sqrt(sum((x - mu) ** 2 for x in v) / (len(v) - 1))

        basin_cmp = []
        for b in basins_:
            per_seed = [100 * (gcn[(b, s)] - gat[(b, s)]) / gcn[(b, s)] for s in seeds]
            g_ = mean(gat[(b, s)] for s in seeds)
            c_ = mean(gcn[(b, s)] for s in seeds)
            basin_cmp.append({
                "basin": b, "split": split[b],
                "persistence": r(mean(per_c[(b, s)] for s in seeds), 3) if per_c else None,
                "mlp": r(mean(mlp[(b, s)] for s in seeds), 3) if mlp else None,
                "gcn": r(c_, 3), "gcnSd": r(seed_sd(gcn, b), 3),
                "gat": r(g_, 3), "gatSd": r(seed_sd(gat, b), 3),
                "gatVsGcnPct": r(100 * (c_ - g_) / c_, 2),
                "seedRangePct": [r(min(per_seed), 2), r(max(per_seed), 2)],
            })
    else:
        M.add("gat_vs_gcn", "GAT over GCN, ungauged discharge RMSE", "—", None, "pending", group="model",
              derivation="recomputed", note="GAT run not in provenance/")

    # ---- attention
    sp = os.path.join(run_dir(MAIN), "attention_scores.csv")
    if os.path.exists(sp):
        a = read_csv(sp)
        src = prov_rel(MAIN, "attention_scores.csv")
        kw = dict(group="attention", derivation="recomputed", source=src, run=MAIN, config_hash=hash_of(MAIN))
        cell = {(x["basin"], int(x["seed"])): x for x in a}
        ab = sorted({b for b, _ in cell})
        asd = sorted({s for _, s in cell})

        def col_stat(col):
            return lambda bs, ss: mean(float(cell[(b, s)][col]) for b in bs for s in ss)

        def ci_for(col):
            st = col_stat(col)
            lo, hi = boot_interval(st, ab, asd)
            return st(ab, asd), interval(lo, hi, len(ab), len(asd))

        conf_v, conf_iv = ci_for("confound_length_r")
        seed_v = None
        cp = os.path.join(run_dir(MAIN), "attention_seed_consistency.csv")
        if os.path.exists(cp):
            c = read_csv(cp)
            per_b = {x["basin"]: float(x["mean_r"]) for x in c}
            sb = sorted(per_b)
            sst = lambda bs, ss: mean(per_b[b] for b in bs)
            slo, shi = boot_interval(sst, sb, [])
            seed_v, seed_iv = sst(sb, []), interval(slo, shi, len(sb), 0)

        ctx = f"reach-length baseline scores {conf_v:+.3f}" + (f"; seeds agree at {seed_v:+.3f}" if seed_v is not None else "")
        v, iv = ci_for("hop_strat_r_all")
        M.add("att_tt_r", "Attention vs travel time, hop-stratified r", f"{v:+.3f}", None, "qualified",
              qualifier=f"chance level, {fmt_ci_r(iv)}; {ctx}", interval=iv,
              note="all message edges; permutation null, 1000 draws", **kw)
        v, iv = ci_for("hop_strat_r_routing")
        M.add("att_tt_r_routing", "Attention vs travel time, routing edges", f"{v:+.3f}", None, "qualified",
              qualifier=f"wrong sign, chance level, {fmt_ci_r(iv)}; {ctx}", interval=iv,
              note="one-hop routing edges only", **kw)
        M.add("att_confound", "Reach-length confound baseline", f"{conf_v:+.3f}", note=fmt_ci_r(conf_iv),
              interval=conf_iv, **kw)
        gst = lambda bs, ss: col_stat("hop_strat_r_all")(bs, ss) - col_stat("confound_length_r")(bs, ss)
        glo, ghi = boot_interval(gst, ab, asd)
        giv = interval(glo, ghi, len(ab), len(asd))
        M.add("att_vs_confound", "Attention minus the reach-length baseline", f"{gst(ab, asd):+.3f}", note=fmt_ci_r(giv),
              interval=giv, **kw)
        M.add("att_entropy", "Mean normalised attention entropy", r(mean(float(x["mean_entropy"]) for x in a), 3),
              note="1.0 = uniform over incoming edges", **kw)
        by_b = defaultdict(list)
        for x in a:
            by_b[x["basin"]].append(x)
        att_basins = [{"basin": b, "r": r(mean(float(x["hop_strat_r_all"]) for x in xs), 3),
                       "p": r(mean(float(x["p_all"]) for x in xs), 3)} for b, xs in sorted(by_b.items())]
        signs = sum(1 for x in att_basins if x["r"] > 0)
        M.add("att_sign", "Basins where attention r is positive", f"{signs} / {len(att_basins)}", **kw)
        if seed_v is not None:
            M.add("att_seed_r", "Attention agreement between seeds", f"{seed_v:+.3f}", None, "qualified",
                  qualifier=f"patterns not stable across seeds; {fmt_ci_r(seed_iv)}", interval=seed_iv,
                  **{**kw, "source": prov_rel(MAIN, "attention_seed_consistency.csv")})
    else:
        M.add("att_tt_r", "Attention vs travel time, hop-stratified r", "—", None, "pending", group="attention",
              derivation="recomputed", note="attention_scores.csv not in provenance/")

    # ---- ablations: same 24 (basin, seed) cells as the reference
    ab_path = os.path.join(PROV, "ablations.csv")
    if os.path.exists(ab_path) and gat:
        rows = read_csv(ab_path)
        ref = next((x for x in rows if x["ablation"].startswith("B1")), None)
        ref_cells, _ = cells_from(ref["run"], "gat") if ref else (None, {})
        ablations = []
        naive = {}
        for x in rows:
            vs = iv = better = None
            if x is not ref and ref_cells:
                cells, _ = cells_from(x["run"], "gat")
                if cells:
                    keys = sorted(set(cells) & set(ref_cells))
                    bs = sorted({b for b, _ in keys})
                    ss = sorted({s for _, s in keys})
                    st = mean_pair_change(cells, ref_cells)
                    vs = st(bs, ss)
                    lo, hi = boot_interval(st, bs, ss)
                    iv = interval(lo, hi, len(bs), len(ss))
                    better = f"{sum(1 for k in keys if cells[k] < ref_cells[k])}/{len(keys)}"
                    rel = [(ref_cells[k] - cells[k]) / ref_cells[k] for k in keys]
                    naive[x["ablation"]] = (len(rel), paired_t_p(rel, [0.0] * len(rel)))
            ablations.append({
                "name": "reference (B1)" if x is ref else x["ablation"],
                "detail": x["detail"], "run": x["run"], "configHash": hash_of(x["run"]),
                "rmse": r(float(x["rmse_all"]), 3), "rmseHeld": r(float(x["rmse_held"]), 3),
                "vsRefPct": r(vs, 2), "interval": iv, "betterIn": better,
                "attnR": r(float(x["attn_r"]), 3),
            })
        und = next((a for a in ablations if a["name"] == "undirected"), None)
        if und and und["interval"]:
            ui = und["interval"]
            M.add("undirected_gain", "Undirected graph vs directed reference", f"{und['vsRefPct']:+.1f}", "%", "qualified",
                  group="ablation", derivation="recomputed",
                  source=prov_rel(und["run"], "metrics_per_seed.csv"), run=und["run"], config_hash=und["configHash"],
                  qualifier=f"{fmt_ci(ui, '%')}; better in only {und['betterIn']} pairs; mechanism unexplained",
                  interval=ui, note="mean per-pair relative change, as in RESULTS.md",
                  supersedes="one-sample t over {} pairs as if independent, p = {:.3f}".format(*naive["undirected"]))

    for id_, label, val, unit, group, note in PENDING_ALWAYS:
        M.add(id_, label, val, unit, "pending", group=group, derivation="recomputed", note=note)

    prov = {
        "thesisCommit": manifest.get("thesisCommit") if manifest else None,
        "datasetVersion": ds_version,
        "runs": [{"id": x["id"], "role": x["role"], "configHash": x["configHash"], "configPath": x["configPath"],
                  "seeds": x["seeds"]} for x in manifest["runs"]] if manifest else [],
        "bootstrap": {"draws": BOOT_DRAWS, "seed": BOOT_SEED, "level": 0.95,
                      "unit": "basins and seeds resampled independently"},
    }
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


STORM_TYPES = """
/** One real storm from the record, every cross-section, hour by hour (hero). */
export type StormEvent = {
  recordStartHour: number
  hours: number
  rule: string
  upstreamIds: string[]
  outletId: string
  gaugeIds: string[]
  /** basin-mean precipitation, mm per hour */
  basinRainMm: number[]
  upstreamRainPeakHour: number
  outletPeakHour: number
  lagHours: number
  /** dischargeM3s only at gauged cross-sections */
  nodes: Record<string, { rainMm: number[]; depthM: number[]; velocityMs: number[]; dischargeM3s?: number[] }>
}

"""

RESULTS_TYPES = """
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

export type Provenance = {
  thesisCommit: string | null
  datasetVersion: string | null
  runs: { id: string; role: string; configHash: string | null; configPath: string | null; seeds: number[] | null }[]
  bootstrap: { draws: number; seed: number; level: number; unit: string }
}
"""


def write_ts(path, header, body):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
        fh.write(body)
    print("wrote", os.path.relpath(path, SITE))


def write_results():
    manifest = load_manifest()
    if manifest:
        check_manifest(manifest)
        with open(os.path.join(PROV, "MANIFEST.json"), "rb") as fh:
            digest = hashlib.sha256(fh.read()).hexdigest()[:16]
    else:
        print("[generate_data] provenance/MANIFEST.json missing; every result will be pending")
        digest = "none"
    metrics, rollout, cmp_, att_b, abl, prov = build_results(manifest)
    body = RESULTS_TYPES + "\n"
    body += f"export const provenance: Provenance = {ts_literal(prov)}\n\n"
    body += f"export const metrics: Metric[] = {ts_literal(metrics)}\n\n"
    body += f"export const rollout: Rollout = {ts_literal(rollout)}\n\n"
    body += f"export const basinComparison: BasinComparison = {ts_literal(cmp_)}\n\n"
    body += f"export const attentionByBasin: AttentionByBasin = {ts_literal(att_b)}\n\n"
    body += f"export const ablations: Ablation[] | null = {ts_literal(abl)}\n"
    write_ts(os.path.join(OUT_DIR, "results.ts"), RESULTS_HEADER.format(digest=digest), body)
    counts = defaultdict(int)
    for m in metrics:
        counts[m["status"]] += 1
    print(f"[generate_data] metrics={len(metrics)} " + " ".join(f"{k}={v}" for k, v in sorted(counts.items())))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("repo", nargs="?", default=os.path.join(SITE, "..", "Machine Learning Project"),
                    help="thesis repo path (default: ../Machine Learning Project)")
    ap.add_argument("--basin", default="basin_01")
    ap.add_argument("--results-only", action="store_true",
                    help="rebuild results.ts from provenance/ alone; touches nothing else")
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    if args.results_only:
        write_results()
        return

    repo = os.path.abspath(args.repo)
    when = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    ds = os.path.join(repo, "flood_routing_dataset")
    have = all(os.path.exists(os.path.join(ds, f)) for f in ("nodes.csv", "edges.csv"))

    if have:
        mode = "thesis-repo"
        sync_provenance(repo)
        net = build_network_from_thesis(repo, args.basin)
        source = "thesis repository" + (f" @ {git_head(repo)[:7]}" if git_head(repo) else "")
        storm = None
        if os.path.exists(os.path.join(ds, "timeseries.csv")):
            series, rec = extract_events(repo, net)
            storm = pick_storm(net, series, rec)
        else:
            series = synth_event(net)
    else:
        mode = "seeded-spec"
        print(f"[generate_data] no dataset CSVs under {ds}; using the seeded spec (brief §6.1)")
        net = build_network_from_spec()
        source = "brief §6.1 seeded spec"
        series = synth_event(net)
        storm = None

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
    # The hero storm is its own module so it loads with the hero's lazy chunks,
    # not with the first paint.
    storm_json = json.dumps(storm, ensure_ascii=False, separators=(",", ":"))
    storm_body = STORM_TYPES + f"\nexport const stormEvent: StormEvent | null = {storm_json}\n"
    write_ts(os.path.join(OUT_DIR, "storm.ts"), HEADER.format(when=when, mode=mode, source=source), storm_body)
    print(f"[generate_data] mode={mode} nodes={len(net['nodes'])} edges={len(net['edges'])} "
          f"attention={'yes' if attention else 'no'}")

    write_results()


if __name__ == "__main__":
    main()
