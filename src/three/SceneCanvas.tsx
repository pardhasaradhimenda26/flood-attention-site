import { Canvas, useFrame, useThree, type CanvasProps } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { getQuality, hasWebGL } from './useAdaptiveQuality'

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/*
  ?debug=frames counts rendered frames per canvas in window.__frames, so the
  pause-when-offscreen behaviour can be checked in a real browser rather than
  assumed.
*/
const countFrames = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'frames'

function FrameCounter({ name }: { name: string }) {
  useFrame(() => {
    const w = window as Window & { __frames?: Record<string, number> }
    w.__frames ??= {}
    w.__frames[name] = (w.__frames[name] ?? 0) + 1
  })
  return null
}

/*
  A device that cannot animate a scene gets its fallback instead of a slide
  show. While the loop runs continuously, after a short warm-up, if the median
  frame interval over 40 frames is above 50 ms (under 20 frames a second) at
  the lowest pixel ratio, or above 100 ms at any, the scene gives way.
*/
function SlowGuard({ active, onSlow, atFloor }: { active: boolean; onSlow: () => void; atFloor: boolean }) {
  const dts = useRef<number[]>([])
  const seen = useRef(0)
  useFrame((_, dt) => {
    if (!active) {
      dts.current = []
      seen.current = 0
      return
    }
    if (++seen.current <= 10) return
    dts.current.push(dt)
    if (dts.current.length < 40) return
    const sorted = [...dts.current].sort((a, b) => a - b)
    dts.current = []
    if (sorted[20] > 0.1 || (sorted[20] > 0.05 && atFloor)) onSlow()
  })
  return null
}

/** Demand-mode canvases draw nothing until asked; ask whenever one comes into view. */
function DrawOnVisible({ visible }: { visible: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (visible) invalidate()
  }, [visible, invalidate])
  return null
}

/*
  Compile every program before the first frame, asynchronously. Chrome links
  shaders in the GPU process; with KHR_parallel_shader_compile three polls for
  completion instead of stalling the main thread on the first render.
*/
function Warmup({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    const done = () => alive && onReady()
    // Without the extension compileAsync would only warn. Compile synchronously
    // in this task instead, so the first frame does not carry it too.
    if (!gl.extensions.has('KHR_parallel_shader_compile')) {
      gl.compile(scene, camera)
      const id = window.setTimeout(done, 0)
      return () => {
        alive = false
        window.clearTimeout(id)
      }
    } else {
      try {
        gl.compileAsync(scene, camera).then(done, done)
      } catch {
        done()
      }
    }
    return () => {
      alive = false
    }
  }, [gl, scene, camera, onReady])
  return null
}

type Props = {
  /** Identifies the canvas in devtools (data-scene attribute). */
  name: string
  /** Shown instead of the canvas when WebGL is missing, fails, or loses context. */
  fallback: ReactNode
  /** 'always' while animating, 'demand' for scenes that only redraw on input. */
  frameloop: 'always' | 'demand'
  camera: CanvasProps['camera']
  shadows?: boolean
  className?: string
  wrapperProps?: HTMLAttributes<HTMLDivElement>
  /** Touch handling on the canvas; 'pan-y' keeps vertical page scroll on phones. */
  touchAction?: 'pan-y' | 'none' | 'manipulation'
  children: ReactNode
}

/**
 * Every WebGL canvas on the page goes through here:
 *  - WebGL probe, error boundary and context-loss all fall back to SVG
 *  - IntersectionObserver stops the render loop while offscreen
 *  - DPR capped per device tier and lowered further if frame rate declines
 */
export function SceneCanvas({
  name,
  fallback,
  frameloop,
  camera,
  shadows = false,
  className,
  wrapperProps,
  touchAction = 'pan-y',
  children,
}: Props) {
  const q = getQuality()
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [lost, setLost] = useState(false)
  const onSlow = useCallback(() => setLost(true), [])
  const [dprMax, setDprMax] = useState(q.dpr[1])
  const [gl] = useState(() => hasWebGL())
  const [compiled, setCompiled] = useState(false)
  const markCompiled = useCallback(() => setCompiled(true), [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '0px',
      threshold: 0,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!gl || lost) {
    return (
      <div className={className} {...wrapperProps}>
        {fallback}
      </div>
    )
  }

  return (
    <div ref={wrap} className={className} data-scene={name} {...wrapperProps}>
      <Boundary fallback={fallback}>
        <Canvas
          frameloop={visible && compiled ? frameloop : 'never'}
          dpr={[q.dpr[0], dprMax]}
          flat
          shadows={shadows && q.shadows ? 'soft' : false}
          camera={camera}
          gl={{ antialias: q.antialias, alpha: false, stencil: false, powerPreference: 'high-performance' }}
          style={{ touchAction }}
          onCreated={({ gl: renderer }) => {
            // Synchronous error checks force a wait on each shader link.
            renderer.debug.checkShaderErrors = import.meta.env.DEV
            renderer.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              setLost(true)
            })
          }}
        >
          <PerformanceMonitor
            onDecline={() => setDprMax((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
            flipflops={3}
          />
          <DrawOnVisible visible={visible && compiled} />
          <SlowGuard
            active={visible && compiled && frameloop === 'always' && !document.hidden}
            atFloor={dprMax <= q.dpr[0] + 1e-6 || dprMax <= 1}
            onSlow={onSlow}
          />
          {countFrames && <FrameCounter name={name} />}
          {children}
          <Warmup onReady={markCompiled} />
        </Canvas>
      </Boundary>
    </div>
  )
}
