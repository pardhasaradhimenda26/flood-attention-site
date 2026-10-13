import { BufferAttribute, BufferGeometry, Vector3, type Curve } from 'three'

/**
 * Tapered tube along a curve. Radius interpolates r0 → r1 so channel width can
 * grow downstream within a reach. Adds `aU` (0 at source, 1 at target), which
 * the wave shader uses as position along the reach — flow direction is baked
 * into the geometry.
 *
 * Frames use a fixed world-up reference instead of Frenet frames, which twist
 * on gently curving, nearly planar rivers.
 */
export function buildTube(
  curve: Curve<Vector3>,
  r0: number,
  r1: number,
  tubular: number,
  radial: number,
): BufferGeometry {
  const rings = tubular + 1
  const per = radial + 1
  const pos = new Float32Array(rings * per * 3)
  const nor = new Float32Array(rings * per * 3)
  const au = new Float32Array(rings * per)
  const idx: number[] = []
  const P = new Vector3()
  const T = new Vector3()
  const N = new Vector3()
  const B = new Vector3()
  const up = new Vector3(0, 1, 0)
  const dir = new Vector3()

  for (let i = 0; i < rings; i++) {
    const u = i / tubular
    curve.getPoint(u, P)
    curve.getTangent(u, T).normalize()
    N.crossVectors(T, up)
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0)
    N.normalize()
    B.crossVectors(N, T).normalize()
    const r = r0 + (r1 - r0) * u
    for (let j = 0; j < per; j++) {
      const a = (j / radial) * Math.PI * 2
      dir.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a))
      const k = i * per + j
      pos[k * 3] = P.x + dir.x * r
      pos[k * 3 + 1] = P.y + dir.y * r
      pos[k * 3 + 2] = P.z + dir.z * r
      nor[k * 3] = dir.x
      nor[k * 3 + 1] = dir.y
      nor[k * 3 + 2] = dir.z
      au[k] = u
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * per + j
      const b = (i + 1) * per + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('aU', new BufferAttribute(au, 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
