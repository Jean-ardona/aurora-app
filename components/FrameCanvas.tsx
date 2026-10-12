'use client'

/**
 * FrameCanvas — crash-proof 504-frame scrubber
 *
 * Memory budget for 1366×768 screen, DPR 1.25:
 *   canvas size  = 1708 × 960 px
 *   per bitmap   = 1708 × 960 × 4 B ≈ 6.6 MB  (decoded at canvas size, not source size)
 *   window ±12   = 25 bitmaps × 6.6 MB ≈ 165 MB GPU
 *   blobs        ≈ 35 MB (JPEG compressed, never decoded)
 *   JS heap      ≈ 30 MB
 *   canvas buf   ≈ 6.6 MB
 *   TOTAL        ≈ 237 MB  — well under Chrome's ~500 MB tab limit
 *
 * Key decisions:
 *   - createImageBitmap(blob, { resizeWidth, resizeHeight, resizeQuality:'high' })
 *     decodes the JPEG already scaled down to canvas pixel size. The GPU never
 *     sees a 1920×1080 texture. On resize the whole bitmap cache is cleared and
 *     re-decoded at the new canvas size.
 *   - DPR capped at 1.25 (1366×768 → 1708×960).
 *   - Bitmap window: ±12 normal, ±8 low-mem (navigator.deviceMemory ≤ 4).
 *     On createImageBitmap failure the window is halved automatically.
 *   - Only 2 concurrent decodes at a time.
 *   - Fast-scroll detection: when |target − current| > FAST_SCROLL_THRESHOLD,
 *     skip decoding intermediate frames; only decode around current target.
 *   - No Image() objects, no img.decode(), no ImageData, no offscreen canvas.
 *   - All mutable state in refs. Zero React re-renders during scroll.
 *   - Debug overlay on ?debug=1: frame idx, bitmap count, MB, pending, FPS.
 *   - AbortController per mount → cleanup on unmount / React Strict Mode.
 */

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { FRAME_COUNT, FIRST_BATCH, getFramePath } from '@/lib/config'

gsap.registerPlugin(ScrollTrigger)

// ─── Constants ───────────────────────────────────────────────────────────────
const DPR_CAP              = 1.25
const SNAP_THRESHOLD       = 0.02
const FAST_SCROLL_THRESHOLD = 30    // frame delta above which we skip intermediates
const MAX_FETCH_CONCURRENT  = 4
const MAX_DECODE_CONCURRENT = 2
const BASE_WINDOW           = 12
const LOW_MEM_WINDOW        = 8

// ─── Module-level singleton ─────────────────────────────────────────────────
// Blobs are fetched once and survive HMR. They are cleared on hard unmount
// via the abortRef signal. This prevents double-fetching in React Strict Mode.
const g_blobs: (Blob | null)[] = new Array(FRAME_COUNT).fill(null)
let   g_blobsFetching = false   // guard against double-start in Strict Mode

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getWindow(halved = false): number {
  const base =
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4
      ? LOW_MEM_WINDOW
      : BASE_WINDOW
  return halved ? Math.max(4, Math.floor(base / 2)) : base
}

interface FrameCanvasProps { onReady: () => void }

export default function FrameCanvas({ onReady }: FrameCanvasProps) {
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const bitmapsRef      = useRef<Map<number, ImageBitmap>>(new Map())
  const canvasSizeRef   = useRef({ w: 0, h: 0 })
  const targetRef       = useRef(0)
  const currentRef      = useRef(0)
  const lastDrawnRef    = useRef(-1)
  const rafRef          = useRef<number>(0)
  const abortRef        = useRef(new AbortController())
  const decodeCountRef  = useRef(0)
  const decodingSetRef  = useRef<Set<number>>(new Set())
  const scrollDirRef    = useRef(1)
  const prevTargetRef   = useRef(0)
  const windowHalvedRef = useRef(false)

  // Debug overlay state — written to DOM directly, not React state
  const dbgRef          = useRef<HTMLDivElement>(null)
  const fpsFramesRef    = useRef(0)
  const fpsLastRef      = useRef(performance.now())
  const fpsRef          = useRef(0)

  const [loadProgress, setLoadProgress] = useState(0)
  const [isReady, setIsReady]           = useState(false)

  // ─── Canvas size ──────────────────────────────────────────────────────────
  function getCanvasPixelSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    return {
      w: Math.floor(window.innerWidth  * dpr),
      h: Math.floor(window.innerHeight * dpr),
    }
  }

  // ─── Cover-fit rect — bitmaps are already canvas-sized, so sx/sy=0 ────────
  // After resize-decode, bitmaps ARE exactly canvas size. drawImage is trivial.
  function drawBitmap(ctx: CanvasRenderingContext2D, bmp: ImageBitmap) {
    const { w, h } = canvasSizeRef.current
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
  }

  // ─── Nearest ready bitmap ─────────────────────────────────────────────────
  function getNearestBitmap(idx: number): ImageBitmap | null {
    const bmp = bitmapsRef.current.get(idx)
    if (bmp) return bmp
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

  // ─── Draw ─────────────────────────────────────────────────────────────────
  function draw(idx: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bmp = getNearestBitmap(idx)
    if (!bmp) return
    drawBitmap(ctx, bmp)
    lastDrawnRef.current = idx
  }

  // ─── Decode one blob at canvas size ───────────────────────────────────────
  async function decodeOne(idx: number): Promise<void> {
    if (bitmapsRef.current.has(idx)) return
    if (decodingSetRef.current.has(idx)) return
    if (!g_blobs[idx]) return
    if (decodeCountRef.current >= MAX_DECODE_CONCURRENT) return

    decodingSetRef.current.add(idx)
    decodeCountRef.current++

    try {
      const blob = g_blobs[idx]!
      const { w, h } = canvasSizeRef.current

      const bmp = await createImageBitmap(blob, {
        resizeWidth:   w,
        resizeHeight:  h,
        resizeQuality: 'high',
      })

      // Stale check
      const win = getWindow(windowHalvedRef.current)
      const center = Math.round(currentRef.current)
      if (Math.abs(idx - center) > win || abortRef.current.signal.aborted) {
        bmp.close()
      } else {
        bitmapsRef.current.set(idx, bmp)
      }
    } catch (e) {
      // createImageBitmap failed — halve the window to reduce pressure
      console.warn('[Aurora] bitmap decode failed, halving window', e)
      windowHalvedRef.current = true
      // Evict aggressively
      evictBitmaps(Math.round(currentRef.current), true)
    } finally {
      decodingSetRef.current.delete(idx)
      decodeCountRef.current--
    }
  }

  // ─── Evict bitmaps outside window ─────────────────────────────────────────
  function evictBitmaps(center: number, forceHalved = false) {
    const win = getWindow(forceHalved || windowHalvedRef.current)
    const lo = Math.max(0, center - win)
    const hi = Math.min(FRAME_COUNT - 1, center + win)
    bitmapsRef.current.forEach((bmp, idx) => {
      if (idx < lo || idx > hi) {
        bmp.close()
        bitmapsRef.current.delete(idx)
      }
    })
  }

  // ─── Update bitmap cache (evict + enqueue decodes) ────────────────────────
  function updateCache(center: number) {
    evictBitmaps(center)
    const win = getWindow(windowHalvedRef.current)
    const lo = Math.max(0, center - win)
    const hi = Math.min(FRAME_COUNT - 1, center + win)
    const dir = scrollDirRef.current

    // Build sorted queue: closest first, biased ahead
    const missing: number[] = []
    for (let k = lo; k <= hi; k++) {
      if (!bitmapsRef.current.has(k) && !decodingSetRef.current.has(k) && g_blobs[k]) {
        missing.push(k)
      }
    }
    missing.sort((a, b) => {
      // Distance from center, minus bonus if ahead of scroll direction
      const da = Math.abs(a - center) - (dir > 0 ? (a > center ? 3 : 0) : (a < center ? 3 : 0))
      const db = Math.abs(b - center) - (dir > 0 ? (b > center ? 3 : 0) : (b < center ? 3 : 0))
      return da - db
    })

    const slots = MAX_DECODE_CONCURRENT - decodeCountRef.current
    missing.slice(0, Math.max(0, slots)).forEach(decodeOne)
  }

  // ─── Debug overlay update (DOM write, no React state) ─────────────────────
  function updateDebug() {
    const el = dbgRef.current
    if (!el) return

    fpsFramesRef.current++
    const now = performance.now()
    if (now - fpsLastRef.current >= 500) {
      fpsRef.current = Math.round(fpsFramesRef.current * 1000 / (now - fpsLastRef.current))
      fpsFramesRef.current = 0
      fpsLastRef.current = now
    }

    const bitmapCount = bitmapsRef.current.size
    const { w, h } = canvasSizeRef.current
    const mbPerBitmap = (w * h * 4) / (1024 * 1024)
    const cacheMB = (bitmapCount * mbPerBitmap).toFixed(1)

    el.textContent =
      `frame: ${Math.round(currentRef.current)} / ${FRAME_COUNT - 1}` +
      ` | bitmaps: ${bitmapCount}` +
      ` | cache: ${cacheMB} MB` +
      ` | decoding: ${decodingSetRef.current.size}` +
      ` | FPS: ${fpsRef.current}` +
      ` | window: ±${getWindow(windowHalvedRef.current)}`
  }

  // ─── RAF loop ─────────────────────────────────────────────────────────────
  function startLoop() {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      // Track scroll direction
      const newTarget = targetRef.current
      if (newTarget !== prevTargetRef.current) {
        scrollDirRef.current = newTarget > prevTargetRef.current ? 1 : -1
        prevTargetRef.current = newTarget
      }

      const prev = currentRef.current
      currentRef.current = prev + (newTarget - prev) * 0.12

      const stillDelta = Math.abs(newTarget - currentRef.current)
      const isFast     = Math.abs(newTarget - currentRef.current) > FAST_SCROLL_THRESHOLD

      let frame: number
      if (stillDelta < SNAP_THRESHOLD) {
        frame = Math.round(newTarget)
        currentRef.current = frame
      } else {
        frame = Math.round(currentRef.current)
      }

      if (frame !== lastDrawnRef.current) {
        draw(frame)
      }

      // During fast scroll, only update cache around target (skip intermediates)
      const cacheCenter = isFast ? Math.round(newTarget) : frame
      updateCache(cacheCenter)

      updateDebug()
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  // ─── Resize ───────────────────────────────────────────────────────────────
  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = getCanvasPixelSize()
    canvas.width  = w
    canvas.height = h
    canvasSizeRef.current = { w, h }

    // Clear bitmap cache — all bitmaps were decoded at old size
    bitmapsRef.current.forEach((b) => b.close())
    bitmapsRef.current.clear()
    decodingSetRef.current.clear()
    decodeCountRef.current = 0

    // Re-decode around current frame
    const center = Math.round(currentRef.current)
    draw(center)          // draws nearest already-in-memory (likely nothing, redraws on next decode)
    updateCache(center)
  }

  // ─── Fetch one blob ───────────────────────────────────────────────────────
  async function fetchBlob(idx: number, signal: AbortSignal): Promise<void> {
    if (g_blobs[idx]) return
    try {
      const res = await fetch(getFramePath(idx), { signal })
      if (!res.ok || signal.aborted) return
      g_blobs[idx] = await res.blob()
    } catch {
      // aborted or network error
    }
  }

  // ─── Load all frames ──────────────────────────────────────────────────────
  async function loadFrames(signal: AbortSignal) {
    if (g_blobsFetching) return   // guard against Strict Mode double-invoke
    g_blobsFetching = true

    const isMobile = window.innerWidth < 768

    // -- First batch --
    const batch0: number[] = []
    for (let i = 0; i < FRAME_COUNT && batch0.length < FIRST_BATCH; i++) {
      if (isMobile && i % 2 !== 0) continue
      batch0.push(i)
    }

    let loaded = 0
    await Promise.all(batch0.map(async (idx) => {
      await fetchBlob(idx, signal)
      if (signal.aborted) return
      loaded++
      setLoadProgress(loaded / FIRST_BATCH)
    }))

    if (signal.aborted) { g_blobsFetching = false; return }

    // Decode first few at canvas size before revealing
    for (const idx of batch0.slice(0, 6)) {
      await decodeOne(idx)
      if (signal.aborted) break
    }

    if (signal.aborted) { g_blobsFetching = false; return }

    setIsReady(true)
    onReady()
    draw(0)

    const { w, h } = canvasSizeRef.current
    console.log(
      `[Aurora] ready | FRAME_COUNT: ${FRAME_COUNT}` +
      ` | canvas: ${w}×${h}` +
      ` | window: ±${getWindow(windowHalvedRef.current)}` +
      ` | MB/bitmap: ${((w * h * 4) / 1048576).toFixed(1)}`
    )

    // -- Background fetch: remaining blobs --
    const remaining: number[] = []
    for (let i = FIRST_BATCH; i < FRAME_COUNT; i++) {
      if (isMobile && i % 2 !== 0) continue
      if (!g_blobs[i]) remaining.push(i)
    }

    let ri = 0
    await Promise.all(Array.from({ length: MAX_FETCH_CONCURRENT }, async () => {
      while (ri < remaining.length) {
        if (signal.aborted) return
        const idx = remaining[ri++]
        await fetchBlob(idx, signal)
        await new Promise<void>((r) => setTimeout(r, 0))
      }
    }))

    if (!signal.aborted) {
      console.log(`[Aurora] all blobs ready: ${g_blobs.filter(Boolean).length}`)
    }
    g_blobsFetching = false
  }

  // ─── Mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController()
    abortRef.current = ac

    // Check ?debug=1
    const isDebug = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1'
    if (dbgRef.current) {
      dbgRef.current.style.display = isDebug ? 'block' : 'none'
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    loadFrames(ac.signal)
    startLoop()

    return () => {
      ac.abort()
      g_blobsFetching = false
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(rafRef.current)
      bitmapsRef.current.forEach((b) => b.close())
      bitmapsRef.current.clear()
      decodingSetRef.current.clear()
      decodeCountRef.current = 0
      // Keep g_blobs alive across HMR — only clear on full page reload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── ScrollTrigger ────────────────────────────────────────────────────────
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
          if (window.innerWidth < 768) {
            const max = Math.floor((FRAME_COUNT - 1) / 2) * 2
            targetRef.current = Math.round(self.progress * max / 2) * 2
          } else {
            targetRef.current = self.progress * (FRAME_COUNT - 1)
          }
        },
      })
      return () => st.kill()
    }, 120)

    return () => clearTimeout(t)
  }, [isReady])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, display: 'block' }}
      />

      {/* Debug overlay — shown only when ?debug=1 */}
      <div
        ref={dbgRef}
        style={{
          display: 'none',
          position: 'fixed', bottom: '16px', left: '16px',
          zIndex: 999, pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: '11px',
          color: '#0f0',
          background: 'rgba(0,0,0,0.75)',
          padding: '6px 10px', borderRadius: '4px',
          whiteSpace: 'pre',
          lineHeight: 1.5,
        }}
      />

      {!isReady && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: '#0A0A0A',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '3rem',
        }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.35em', textTransform: 'uppercase', color: '#F5F5F2' }}>
            AURORA
          </p>
          <div style={{ width: '120px', height: '1px', background: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${loadProgress * 100}%`, background: '#F5F5F2', transition: 'width 0.1s linear' }} />
          </div>
        </div>
      )}
    </>
  )
}
