/*
  Fetches the hero's model output and builds the valley's arrays off the main
  thread. Replies once, transferring every buffer.
*/
import { buildValleyArrays, transferables, type ValleyParams } from './valleyBuild'

type Ctx = {
  onmessage: ((e: MessageEvent<{ base: string; p: ValleyParams }>) => void) | null
  postMessage: (m: unknown, transfer?: ArrayBuffer[]) => void
}
const ctx = self as unknown as Ctx

ctx.onmessage = async (e) => {
  const { base, p } = e.data
  try {
    const get = (f: string) =>
      fetch(base + f).then((r) => {
        if (!r.ok) throw new Error(f + ' ' + r.status)
        return r.arrayBuffer()
      })
    const [t, w, f] = await Promise.all([get('terrain.bin'), get('wet.bin'), get('flood.bin')])
    const a = buildValleyArrays(new Float32Array(t), new Uint32Array(w), p)
    ctx.postMessage({ ok: true, flood: new Uint8Array(f), a }, [f, ...transferables(a)])
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) })
  }
}
