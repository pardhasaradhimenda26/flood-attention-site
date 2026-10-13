import { CatmullRomCurve3, Curve, QuadraticBezierCurve3, Vector3 } from 'three'
import { downstreamOf, incomingRouting, nodeById } from '../lib/graph'

/** A sub-range of another curve, re-parametrised to [0, 1]. */
class SegmentCurve extends Curve<Vector3> {
  constructor(
    private base: Curve<Vector3>,
    private a: number,
    private b: number,
  ) {
    super()
  }
  getPoint(t: number, target = new Vector3()) {
    return this.base.getPoint(this.a + (this.b - this.a) * t, target)
  }
}

const v = (p: [number, number, number], lift = 0) => new Vector3(p[0], p[1] + lift, p[2])

/**
 * Smooth path for a routing reach: a centripetal Catmull-Rom spline through
 * the previous node, both ends and the next node, keeping only the middle
 * span, so consecutive reaches join with continuous tangents.
 */
export function reachCurve(sourceId: string, targetId: string, lift = 0): Curve<Vector3> {
  const s = nodeById.get(sourceId)!
  const t = nodeById.get(targetId)!
  const S = v(s.pos, lift)
  const T = v(t.pos, lift)
  const ups = incomingRouting.get(sourceId) ?? []
  const upEdge = ups.find((e) => nodeById.get(e.source)!.branch === s.branch) ?? ups[0]
  const P = upEdge ? v(nodeById.get(upEdge.source)!.pos, lift) : S.clone().multiplyScalar(2).sub(T)
  const down = downstreamOf.get(targetId)
  const N = down ? v(nodeById.get(down.target)!.pos, lift) : T.clone().multiplyScalar(2).sub(S)
  const base = new CatmullRomCurve3([P, S, T, N], false, 'centripetal')
  return new SegmentCurve(base, 1 / 3, 2 / 3)
}

/** Arc for a message edge that skips reaches; higher for more hops. */
export function messageArc(sourceId: string, targetId: string, hops: number, lift = 0): Curve<Vector3> {
  const S = v(nodeById.get(sourceId)!.pos, lift)
  const T = v(nodeById.get(targetId)!.pos, lift)
  const mid = S.clone().add(T).multiplyScalar(0.5)
  mid.y += 0.35 + hops * 0.42 + S.distanceTo(T) * 0.12
  return new QuadraticBezierCurve3(S, mid, T)
}
