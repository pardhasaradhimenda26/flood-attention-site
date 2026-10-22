/*
  Fetches the hero's model output and builds the valley's arrays off the main
  thread. Replies once, transferring every buffer.
*/
import { buildValleyArrays, transferables, type ValleyParams } from './valleyBuild'

type Ctx = {
  onmessage: ((e: MessageEvent<{ base: string; p: ValleyParams }>) => void) | null
  postMessage: (m: unknown, transfer?: Transferable[]) => void
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
    // Imagery is context, not data: without it the ground falls back to the plain survey style.
    const img = fetch(base + 'imagery.jpg')
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('imagery ' + r.status))))
      .then((b) => createImageBitmap(b))
      .catch(() => null)
    const [t, w, f, v] = await Promise.all([get('terrain.bin'), get('wet.bin'), get('flood.bin'), get('vel.bin')])
    const a = buildValleyArrays(new Float32Array(t), new Uint32Array(w), p)
    const bitmap = await img
    const transfer: Transferable[] = [f, v, ...transferables(a)]
    if (bitmap) transfer.push(bitmap)
    ctx.postMessage({ ok: true, flood: new Uint8Array(f), vel: new Int8Array(v), img: bitmap, a }, transfer)
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) })
  }
}
