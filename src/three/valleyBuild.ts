/*
  The hero valley's arrays, built without three.js so the same code runs in a
  worker (valley.worker.ts) or, where workers are unavailable, on the main
  thread. On the 351 × 320 grid this is a long task on a slow phone; in the
  worker it never blocks the page.
*/

export type ValleyParams = {
  nx: number
  ny: number
  /** Grid cell, m. */
  cellM: number
  /** Lowest bed elevation, m: world y = 0. */
  bedLo: number
  /** Vertical exaggeration. */
  vex: number
  /** World units per kilometre. */
  km: number
  /** Vertex stride over the grid (2 on the low quality tier). */
  stride: number
}

export type ValleyArrays = {
  /** Ground elevation, m, on the full grid: modelled cells exact, the rest filled. */
  ground: Float32Array
  position: Float32Array
  normal: Float32Array
  /** 1 inside the modelled area, 0 in the fill. */
  inside: Float32Array
  terrainIndex: Uint32Array
  /**
   * The water is its own compact mesh: only the vertices of quads that are
   * ever wet (about a seventh of the grid), so the per-frame depth update and
   * its upload stay small.
   */
  waterPosition: Float32Array
  /** Each water vertex's index in the wet-cell list, or −1. */
  waterWet: Int32Array
  waterIndex: Uint32Array
  stride: number
}

/** Fill the ground outside the modelled area: nearest modelled bed, rising with distance. */
export function filledBed(bed: Float32Array, nx: number, ny: number) {
  const n = nx * ny
  const out = new Float32Array(n)
  const dist = new Int32Array(n).fill(-1)
  const near = new Float32Array(n)
  const q = new Int32Array(n)
  let qh = 0
  let qt = 0
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(bed[i])) {
      dist[i] = 0
      near[i] = bed[i]
      q[qt++] = i
    }
  }
  const visit = (i: number, j: number) => {
    if (dist[j] < 0) {
      dist[j] = dist[i] + 1
      near[j] = near[i]
      q[qt++] = j
    }
  }
  while (qh < qt) {
    const i = q[qh++]
    const r = Math.floor(i / nx)
    const c = i - r * nx
    if (c > 0) visit(i, i - 1)
    if (c < nx - 1) visit(i, i + 1)
    if (r > 0) visit(i, i - nx)
    if (r < ny - 1) visit(i, i + nx)
  }
  for (let i = 0; i < n; i++) out[i] = dist[i] === 0 ? bed[i] : near[i] + 2.5 * Math.sqrt(Math.max(0, dist[i]))
  // Nearest-cell fill is piecewise constant and draws terraces; smooth the
  // fill (three passes of a 9-cell box blur) and leave modelled cells exact.
  const tmp = new Float32Array(n)
  const R = 4
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        let sum = 0
        let k = 0
        for (let d = -R; d <= R; d++) {
          const cc = c + d
          if (cc >= 0 && cc < nx) {
            sum += out[r * nx + cc]
            k++
          }
        }
        tmp[r * nx + c] = sum / k
      }
    }
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const i = r * nx + c
        if (dist[i] === 0) continue
        let sum = 0
        let k = 0
        for (let d = -R; d <= R; d++) {
          const rr = r + d
          if (rr >= 0 && rr < ny) {
            sum += tmp[rr * nx + c]
            k++
          }
        }
        // Blend toward the smoothed value away from the modelled edge.
        const w = Math.min(1, dist[i] / 3)
        out[i] = out[i] * (1 - w) + (sum / k) * w
      }
    }
  }
  return { y: out, dist }
}

/** Area-weighted vertex normals, as three's BufferGeometry.computeVertexNormals. */
function vertexNormals(pos: Float32Array, index: Uint32Array) {
  const nrm = new Float32Array(pos.length)
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3
    const b = index[t + 1] * 3
    const c = index[t + 2] * 3
    // (C − B) × (A − B)
    const cbx = pos[c] - pos[b]
    const cby = pos[c + 1] - pos[b + 1]
    const cbz = pos[c + 2] - pos[b + 2]
    const abx = pos[a] - pos[b]
    const aby = pos[a + 1] - pos[b + 1]
    const abz = pos[a + 2] - pos[b + 2]
    const x = cby * abz - cbz * aby
    const y = cbz * abx - cbx * abz
    const z = cbx * aby - cby * abx
    for (const v of [a, b, c]) {
      nrm[v] += x
      nrm[v + 1] += y
      nrm[v + 2] += z
    }
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1
    nrm[v] /= l
    nrm[v + 1] /= l
    nrm[v + 2] /= l
  }
  return nrm
}

export function buildValleyArrays(bed: Float32Array, wetCells: Uint32Array, p: ValleyParams): ValleyArrays {
  const { nx: gx, ny: gy, stride } = p
  const cellKm = p.cellM / 1000
  const cx = (gx * cellKm) / 2
  const cz = (gy * cellKm) / 2
  const nx = Math.floor((gx - 1) / stride) + 1
  const ny = Math.floor((gy - 1) / stride) + 1
  const { y: ground, dist } = filledBed(bed, gx, gy)
  const wetIndex = new Int32Array(gx * gy).fill(-1)
  wetCells.forEach((g, k) => (wetIndex[g] = k))
  const count = nx * ny
  const position = new Float32Array(count * 3)
  const inside = new Float32Array(count)
  const vtxWet = new Int32Array(count)
  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const k = r * nx + c
      const g = r * stride * gx + c * stride
      position[k * 3] = (c * stride * cellKm - cx) * p.km
      position[k * 3 + 1] = ((ground[g] - p.bedLo) * p.vex) / 1000
      position[k * 3 + 2] = (r * stride * cellKm - cz) * p.km
      inside[k] = dist[g] === 0 ? 1 : 0
      vtxWet[k] = wetIndex[g]
    }
  }
  const quads = (nx - 1) * (ny - 1)
  const terrainIndex = new Uint32Array(quads * 6)
  const wet = new Uint32Array(quads * 6)
  let ti = 0
  let wi = 0
  for (let r = 0; r < ny - 1; r++) {
    for (let c = 0; c < nx - 1; c++) {
      const a = r * nx + c
      const b = a + 1
      const e = a + nx
      const f = e + 1
      terrainIndex.set([a, e, b, b, e, f], ti)
      ti += 6
      if (vtxWet[a] >= 0 || vtxWet[b] >= 0 || vtxWet[e] >= 0 || vtxWet[f] >= 0) {
        wet.set([a, e, b, b, e, f], wi)
        wi += 6
      }
    }
  }
  // Compact the water mesh to the vertices its triangles use.
  const remap = new Int32Array(count).fill(-1)
  let nv = 0
  for (let t = 0; t < wi; t++) if (remap[wet[t]] < 0) remap[wet[t]] = nv++
  const waterPosition = new Float32Array(nv * 3)
  const waterWet = new Int32Array(nv)
  for (let k = 0; k < count; k++) {
    const v = remap[k]
    if (v < 0) continue
    waterPosition[v * 3] = position[k * 3]
    waterPosition[v * 3 + 1] = position[k * 3 + 1]
    waterPosition[v * 3 + 2] = position[k * 3 + 2]
    waterWet[v] = vtxWet[k]
  }
  const waterIndex = new Uint32Array(wi)
  for (let t = 0; t < wi; t++) waterIndex[t] = remap[wet[t]]
  return {
    ground,
    position,
    normal: vertexNormals(position, terrainIndex),
    inside,
    terrainIndex,
    waterPosition,
    waterWet,
    waterIndex,
    stride,
  }
}

/** The buffers to transfer out of the worker. */
export function transferables(a: ValleyArrays): ArrayBuffer[] {
  return [a.ground, a.position, a.normal, a.inside, a.terrainIndex, a.waterPosition, a.waterWet, a.waterIndex].map((x) => x.buffer as ArrayBuffer)
}
