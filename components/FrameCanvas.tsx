'use client'

/**
 * FrameCanvas — progressive 4-pass loader with sliding bitmap cache.
 *
 * PASSES
 *   Pass 1 (stride 8, ~64 frames)  → page usable, loader hidden
 *   Pass 2 (stride 4, ~64 frames)  → refinement
 *   Pass 3 (stride 2, ~126 frames) → smoother
 *   Pass 4 (stride 1, remaining)   → full quality
 *   Data-saver: passes 1+2 only, scroll mapped to available frames.
 *
 * Within each pass, frames are fetched closest to current scroll first.
 *
 * MEMORY
 *   Blobs: compressed, ~35 MB total, kept for on-demand decode.
 *   Bitmaps: decoded at canvas pixel size (not source size).
 *   Cache window: ±12 frames (±8 low-mem). All outside are closed().
 *   DPR capped at 1.25.
 *
 * REACT
 *   Only two useState calls (loadProgress, isReady).
 *   All scroll/draw state lives in refs → zero re-renders during scroll.
 *   AbortController per mount, cleaned up on unmount.
 *   g_blobs is module-level to survive HMR without re-fetching.
 *
 * DEBUG
 *   Add ?debug=1 to the URL to see the overlay.
 */

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  FRAME_COUNT,
  LOAD_PASSES,
  getFramePath,
  isDataSaver,
} from '@/lib/config'

gsap.registerPlugin(ScrollTrigger)

// ─── Tuning ──────────────────────────────────────────────────────────────────
const DPR_CAP               = 1.25
const SNAP_THRESHOLD        = 0.02
const FAST_SCROLL_THRESHOLD = 30
const MAX_FETCH_CONCURRENT  = 6
const MAX_DECODE_CONCURRENT = 2
const BASE_WINDOW           = 12
const LOW_MEM_WINDOW        = 8

// ─── Module-level blob store (survives HMR) ──────────────────────────────────
const g_blobs: (Blob | null)[] = new Array(FRAME_COUNT).fill(null)
// Track which frames are considered "loaded" (blob available)
const g_loaded: boolean[] = new Array(FRAME_COUNT).fill(false)

function getWindow(): number {
  if (typeof navigator === 'undefined') return BASE_WINDOW
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return mem !== undefined && mem <= 4 ? LOW_MEM_WINDOW : BASE_WINDOW
}

interface FrameCanvasProps { onReady: () => void }

export default function FrameCanvas({ onReady }: FrameCanvasProps) {
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const bitmapsRef       = useRef<Map<number, ImageBitmap>>(new Map())
  const canvasSizeRef    = useRef({ w: 0, h: 0 })
  const targetRef        = useRef(0)
  const currentRef       = useRef(0)
  const lastDrawnRef     = useRef(-1)
  const rafRef           = useRef<number>(0)
  const abortRef         = useRef(new AbortController())
  const decodeCountRef   = useRef(0)
  const decodingSetRef   = useRef<Set<number>>(new Set())
  const scrollDirRef     = useRef(1)
  const prevTargetRef    = useRef(0)
  const windowHalvedRef  = useRef(false)
  const dataSaverRef     = useRef(false)
  // Available frame indices after pass 1 (for data-saver scroll mapping)
  const availableRef     = useRef<number[]>([])
  // Progress of background passes 2-4 (0..1), written to DOM directly
  const bgProgressRef    = useRef(0)
  const bgBarRef         = useRef<HTMLDivElement>(null)
  const bgBarOuterRef    = useRef<HTMLDivElement>(null)
  // Debug overlay
  const dbgRef           = useRef<HTMLDivElement>(null)
  const fpsFramesRef     = useRef(0)
  const fpsLastRef       = useRef(0)
  const fpsRef           = useRef(0)

  const [loadProgress, setLoadProgress] = useState(0)
  const [isReady, setIsReady]           = useState(false)

  // ─── Canvas pixel size ─────────────────────────────────────────────────────
  function getCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    return {
      w: Math.floor(window.innerWidth  * dpr),
      h: Math.floor(window.innerHeight * dpr),
    }
  }

  // ─── Nearest ready bitmap (never blank) ────────────────────────────────────
  function getNearestBitmap(idx: number): ImageBitmap | null {
    const exact = bitmapsRef.current.get(idx)
    if (exact) return exact
    for (let d = 1; d < FRAME_COUNT; d++) {
      for (const k of [idx - d, idx + d]) {
        if (k >= 0 && k < FRAME_COUNT) {
          const b = bitmapsRef.current.get(k)
          if (b) return b
        }
      }
    }
    return null
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────
  function draw(idx: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bmp = getNearestBitmap(idx)
    if (!bmp) return
    const { w, h } = canvasSizeRef.current
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, w, h)
    // Bitmaps are decoded at canvas size — simple full-canvas draw
    ctx.drawImage(bmp, 0, 0, w, h)
    lastDrawnRef.current = idx
  }

  // ─── Evict bitmaps outside window ─────────────────────────────────────────
  function evict(center: number, halved = false) {
    const win = halved ? Math.max(4, Math.floor(getWindow() / 2)) : getWindow()
    const lo = Math.max(0, center - win)
    const hi = Math.min(FRAME_COUNT - 1, center + win)
    bitmapsRef.current.forEach((bmp, idx) => {
      if (idx < lo || idx > hi) { bmp.close(); bitmapsRef.current.delete(idx) }
    })
  }

  // ─── Decode one blob at canvas size ────────────────────────────────────────
  async function decodeOne(idx: number) {
    if (bitmapsRef.current.has(idx)) return
    if (decodingSetRef.current.has(idx)) return
    if (!g_blobs[idx]) return
    if (decodeCountRef.current >= MAX_DECODE_CONCURRENT) return

    decodingSetRef.current.add(idx)
    decodeCountRef.current++
    try {
      const { w, h } = canvasSizeRef.current
      const bmp = await createImageBitmap(g_blobs[idx]!, {
        resizeWidth: w, resizeHeight: h, resizeQuality: 'high',
      })
      const win = windowHalvedRef.current
        ? Math.max(4, Math.floor(getWindow() / 2))
        : getWindow()
      const center = Math.round(currentRef.current)
      if (Math.abs(idx - center) > win || abortRef.current.signal.aborted) {
        bmp.close()
      } else {
        bitmapsRef.current.set(idx, bmp)
      }
    } catch {
      // decode failed → halve window
      windowHalvedRef.current = true
      evict(Math.round(currentRef.current), true)
    } finally {
      decodingSetRef.current.delete(idx)
      decodeCountRef.current--
    }
  }

  // ─── Update bitmap cache ───────────────────────────────────────────────────
  function updateCache(center: number) {
    evict(center)
    const win = windowHalvedRef.current
      ? Math.max(4, Math.floor(getWindow() / 2))
      : getWindow()
    const lo = Math.max(0, center - win)
    const hi = Math.min(FRAME_COUNT - 1, center + win)
    const dir = scrollDirRef.current

    const missing: number[] = []
    for (let k = lo; k <= hi; k++) {
      if (!bitmapsRef.current.has(k) && !decodingSetRef.current.has(k) && g_blobs[k]) {
        missing.push(k)
      }
    }
    missing.sort((a, b) => {
      const da = Math.abs(a - center) - (dir > 0 ? (a > center ? 3 : 0) : (a < center ? 3 : 0))
      const db = Math.abs(b - center) - (dir > 0 ? (b > center ? 3 : 0) : (b < center ? 3 : 0))
      return da - db
    })
    const slots = MAX_DECODE_CONCURRENT - decodeCountRef.current
    missing.slice(0, Math.max(0, slots)).forEach(decodeOne)
  }

  // ─── Resolve frame index for data-saver scroll mapping ────────────────────
  function resolveFrame(rawTarget: number): number {
    if (!dataSaverRef.current) return rawTarget
    const avail = availableRef.current
    if (avail.length === 0) return 0
    // Map rawTarget (0..FRAME_COUNT-1) to nearest available index
    const ideal = Math.round(rawTarget)
    let best = avail[0], bestDist = Math.abs(ideal - avail[0])
    for (const f of avail) {
      const d = Math.abs(ideal - f)
      if (d < bestDist) { bestDist = d; best = f }
    }
    return best
  }

  // ─── Debug overlay ─────────────────────────────────────────────────────────
  function updateDebug() {
    const el = dbgRef.current
    if (!el || el.style.display === 'none') return
    fpsFramesRef.current++
    const now = performance.now()
    if (now - fpsLastRef.current >= 500) {
      fpsRef.current = Math.round(fpsFramesRef.current * 1000 / (now - fpsLastRef.current))
      fpsFramesRef.current = 0
      fpsLastRef.current = now
    }
    const { w, h } = canvasSizeRef.current
    const n = bitmapsRef.current.size
    const mb = ((w * h * 4 * n) / 1048576).toFixed(1)
    el.textContent =
      `frame: ${Math.round(currentRef.current)}/${FRAME_COUNT - 1}` +
      ` | bitmaps: ${n} (${mb}MB)` +
      ` | decoding: ${decodingSetRef.current.size}` +
      ` | FPS: ${fpsRef.current}` +
      ` | win: ±${windowHalvedRef.current ? Math.max(4, Math.floor(getWindow() / 2)) : getWindow()}` +
      ` | blobs: ${g_blobs.filter(Boolean).length}/${FRAME_COUNT}` +
      (dataSaverRef.current ? ' | datasaver' : '')
  }

  // ─── Background progress bar (DOM write, no state) ────────────────────────
  function updateBgBar(progress: number, done: boolean) {
    bgProgressRef.current = progress
    const bar = bgBarRef.current
    const outer = bgBarOuterRef.current
    if (!bar || !outer) return
    if (done) {
      outer.style.opacity = '0'
      setTimeout(() => { if (outer) outer.style.display = 'none' }, 600)
      return
    }
    outer.style.display = 'block'
    outer.style.opacity = '1'
    bar.style.width = `${Math.round(progress * 100)}%`
  }

  // ─── RAF loop ──────────────────────────────────────────────────────────────
  function startLoop() {
    fpsLastRef.current = performance.now()
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const newTarget = targetRef.current
      if (newTarget !== prevTargetRef.current) {
        scrollDirRef.current = newTarget > prevTargetRef.current ? 1 : -1
        prevTargetRef.current = newTarget
      }
      const prev = currentRef.current
      currentRef.current = prev + (newTarget - prev) * 0.12
      const stillDelta = Math.abs(newTarget - currentRef.current)
      const isFast = Math.abs(newTarget - prev) > FAST_SCROLL_THRESHOLD

      let frame: number
      if (stillDelta < SNAP_THRESHOLD) {
        frame = Math.round(newTarget)
        currentRef.current = frame
      } else {
        frame = Math.round(currentRef.current)
      }

      const resolved = resolveFrame(frame)
      if (resolved !== lastDrawnRef.current) draw(resolved)

      const cacheCenter = isFast ? Math.round(resolveFrame(newTarget)) : resolved
      updateCache(cacheCenter)
      updateDebug()
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  // ─── Resize ────────────────────────────────────────────────────────────────
  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = getCanvasSize()
    canvas.width = w; canvas.height = h
    canvasSizeRef.current = { w, h }
    // Clear bitmap cache — bitmaps were decoded at old size
    bitmapsRef.current.forEach((b) => b.close())
    bitmapsRef.current.clear()
    decodingSetRef.current.clear()
    decodeCountRef.current = 0
    updateCache(Math.round(currentRef.current))
  }

  // ─── Fetch one blob ────────────────────────────────────────────────────────
  async function fetchBlob(idx: number, signal: AbortSignal): Promise<boolean> {
    if (g_blobs[idx]) return true
    try {
      const res = await fetch(getFramePath(idx), { signal })
      if (!res.ok || signal.aborted) return false
      g_blobs[idx] = await res.blob()
      g_loaded[idx] = true
      return true
    } catch {
      return false
    }
  }

  // ─── Concurrency-limited fetch pool ───────────────────────────────────────
  async function fetchPool(indices: number[], signal: AbortSignal): Promise<void> {
    let i = 0
    await Promise.all(Array.from({ length: MAX_FETCH_CONCURRENT }, async () => {
      while (i < indices.length) {
        if (signal.aborted) return
        const idx = indices[i++]
        await fetchBlob(idx, signal)
        // Yield to keep UI responsive
        await new Promise<void>((r) => setTimeout(r, 0))
      }
    }))
  }

  // ─── Sort indices by proximity to current scroll ───────────────────────────
  function sortByProximity(indices: number[]): number[] {
    const center = Math.round(currentRef.current)
    const dir = scrollDirRef.current
    return [...indices].sort((a, b) => {
      // Closest first; frames ahead of scroll direction get a bonus
      const da = Math.abs(a - center) - (dir > 0 ? (a > center ? 4 : 0) : (a < center ? 4 : 0))
      const db = Math.abs(b - center) - (dir > 0 ? (b > center ? 4 : 0) : (b < center ? 4 : 0))
      return da - db
    })
  }

  // ─── Build indices for a pass stride (excluding already loaded) ─────────────
  function passIndices(stride: number): number[] {
    const out: number[] = []
    for (let i = 0; i < FRAME_COUNT; i += stride) {
      if (!g_blobs[i]) out.push(i)
    }
    return out
  }

  // ─── Main load orchestrator ────────────────────────────────────────────────
  async function loadFrames(signal: AbortSignal) {
    dataSaverRef.current = isDataSaver()

    // ── PASS 1: every 8th frame + frame 0 + last frame ──────────────────────
    const pass1Raw: number[] = [0]
    for (let i = 0; i < FRAME_COUNT; i += LOAD_PASSES[0]) {
      if (i !== 0) pass1Raw.push(i)
    }
    pass1Raw.push(FRAME_COUNT - 1)
    const pass1 = [...new Set(pass1Raw)].sort((a, b) => a - b)

    let p1Loaded = 0
    // Fetch pass 1 sorted by proximity, with progress update
    await Promise.all(Array.from({ length: MAX_FETCH_CONCURRENT }, async () => {
      const sorted = sortByProximity(pass1)
      let i = 0
      while (i < sorted.length) {
        if (signal.aborted) return
        // Re-sort every 16 fetches to stay ahead of scroll
        if (i > 0 && i % 16 === 0) sorted.splice(0, sorted.length, ...sortByProximity(pass1.filter((x) => !g_blobs[x])))
        const idx = sorted[i++]
        if (!g_blobs[idx]) {
          await fetchBlob(idx, signal)
          p1Loaded++
          setLoadProgress(p1Loaded / pass1.length)
        }
      }
    }))

    if (signal.aborted) return

    // Decode first 6 frames of pass 1 before revealing
    const firstDecodes = pass1.slice(0, 6)
    await Promise.all(firstDecodes.map(decodeOne))

    if (signal.aborted) return

    // Page is usable — hide loading screen
    availableRef.current = pass1.filter((i) => g_blobs[i])
    setIsReady(true)
    onReady()
    draw(0)

    const { w, h } = canvasSizeRef.current
    console.log(
      `[Aurora] Pass 1 done | ${pass1.length} frames | canvas ${w}×${h}` +
      ` | bitmap ±${getWindow()} | dataSaver: ${dataSaverRef.current}`
    )

    if (dataSaverRef.current) {
      // Data-saver: pass 2 only then stop
      const pass2 = sortByProximity(passIndices(LOAD_PASSES[1]))
      await fetchPool(pass2, signal)
      if (!signal.aborted) {
        availableRef.current = Array.from({ length: Math.ceil(FRAME_COUNT / LOAD_PASSES[1]) }, (_, i) => i * LOAD_PASSES[1]).filter((x) => x < FRAME_COUNT && g_blobs[x])
        updateBgBar(1, true)
        console.log('[Aurora] Data-saver: pass 2 done')
      }
      return
    }

    // ── PASSES 2, 3, 4 in background ────────────────────────────────────────
    const bgPasses = [LOAD_PASSES[1], LOAD_PASSES[2], LOAD_PASSES[3]] as const
    // Total frames still to fetch across passes 2-4
    let totalBg = 0
    for (const stride of bgPasses) totalBg += passIndices(stride).length
    let bgDone = 0

    for (let pi = 0; pi < bgPasses.length; pi++) {
      if (signal.aborted) return
      const stride = bgPasses[pi]
      // Sort by proximity at the start of each pass
      const indices = sortByProximity(passIndices(stride))

      // Fetch with progress update on each completion
      let ii = 0
      await Promise.all(Array.from({ length: MAX_FETCH_CONCURRENT }, async () => {
        while (ii < indices.length) {
          if (signal.aborted) return
          const idx = indices[ii++]
          if (!g_blobs[idx]) {
            await fetchBlob(idx, signal)
            bgDone++
            updateBgBar(bgDone / totalBg, false)
          }
          await new Promise<void>((r) => setTimeout(r, 0))
        }
      }))

      if (!signal.aborted) {
        console.log(`[Aurora] Pass ${pi + 2} done | stride ${stride} | total blobs: ${g_blobs.filter(Boolean).length}`)
      }
    }

    if (!signal.aborted) {
      updateBgBar(1, true)
      console.log(`[Aurora] All passes complete | ${g_blobs.filter(Boolean).length} blobs`)
    }
  }

  // ─── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController()
    abortRef.current = ac

    const isDebug = new URLSearchParams(window.location.search).get('debug') === '1'
    if (dbgRef.current) dbgRef.current.style.display = isDebug ? 'block' : 'none'

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    loadFrames(ac.signal)
    startLoop()

    return () => {
      ac.abort()
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(rafRef.current)
      bitmapsRef.current.forEach((b) => b.close())
      bitmapsRef.current.clear()
      decodingSetRef.current.clear()
      decodeCountRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── ScrollTrigger ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const t = setTimeout(() => {
      const container = document.getElementById('scroll-container')
      if (!container) return

      ;[0, 0.25, 0.5, 0.75, 1].forEach((p) => {
        console.log(`[Aurora] scroll ${Math.round(p * 100)}% → frame ${(p * (FRAME_COUNT - 1)).toFixed(1)}`)
      })

      const st = ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          const raw = self.progress * (FRAME_COUNT - 1)
          if (window.innerWidth < 768) {
            const max = Math.floor((FRAME_COUNT - 1) / 2) * 2
            targetRef.current = Math.round(self.progress * max / 2) * 2
          } else {
            targetRef.current = raw
          }
        },
      })
      return () => st.kill()
    }, 120)

    return () => clearTimeout(t)
  }, [isReady])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, display: 'block' }}
      />

      {/* Background loading progress bar — passes 2-4, bottom of screen */}
      <div
        ref={bgBarOuterRef}
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: '2px',
          zIndex: 49,
          pointerEvents: 'none',
          opacity: 1,
          transition: 'opacity 0.6s ease',
        }}
      >
        <div
          ref={bgBarRef}
          style={{
            height: '100%',
            width: '0%',
            background: 'rgba(255,255,255,0.28)',
            transition: 'width 0.3s linear',
          }}
        />
      </div>

      {/* Debug overlay — ?debug=1 */}
      <div
        ref={dbgRef}
        style={{
          display: 'none',
          position: 'fixed', bottom: '16px', left: '16px',
          zIndex: 999, pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: '11px', color: '#0f0',
          background: 'rgba(0,0,0,0.78)',
          padding: '6px 10px', borderRadius: '4px',
          whiteSpace: 'pre', lineHeight: 1.5,
        }}
      />

      {/* Loading screen — hidden after pass 1 */}
      {!isReady && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: '#0A0A0A',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '3rem',
        }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500,
            letterSpacing: '0.35em', textTransform: 'uppercase', color: '#F5F5F2',
          }}>
            AURORA
          </p>
          <div style={{
            width: '120px', height: '1px',
            background: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${loadProgress * 100}%`,
              background: '#F5F5F2',
              transition: 'width 0.15s linear',
            }} />
          </div>
        </div>
      )}
    </>
  )
}
