'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap }            from 'gsap'
import { ScrollTrigger }   from 'gsap/ScrollTrigger'
import { resolveVideoSrc } from '@/lib/config'
import LoadingScreen       from './LoadingScreen'

gsap.registerPlugin(ScrollTrigger)

const TIME_DECAY   = 12
const SNAP_S       = 0.01
const MIN_DELTA_S  = 1 / 60
const FAST_SCROLL  = 0.4
const SEEK_HIST    = 200
const SLOW_SEEK_MS = 50
const INSTANT_MS   = 300   // hide loader if ready within this time

function pct(arr: number[], p: number) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(p / 100 * (s.length - 1))]
}

interface Props { onReady: () => void }

export default function VideoScrubber({ onReady }: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const blobUrlRef   = useRef<string | null>(null)
  const targetRef    = useRef(0)
  const currentRef   = useRef(0)
  const lastSetRef   = useRef(-1)
  const lastRafRef   = useRef(0)
  const rafRef       = useRef(0)
  const startedRef   = useRef(false)

  // Seek stats
  const seekTsRef    = useRef<Map<number, number>>(new Map())
  const seekLatsRef  = useRef<number[]>([])
  const slowSeeksRef = useRef(0)

  // Backdrop
  const prevProgRef  = useRef(0)
  const prevTimeRef  = useRef(0)
  const bdTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bdOffRef     = useRef(false)

  // Debug
  const dbgRef       = useRef<HTMLDivElement>(null)
  const isDebugRef   = useRef(false)
  const fpsCountRef  = useRef(0)
  const fpsLastRef   = useRef(0)
  const fpsRef       = useRef(0)
  const loadStartRef = useRef(0)
  const loadTimeRef  = useRef(0)

  // Loading screen state
  const [loadedBytes,  setLoadedBytes]  = useState(0)
  const [totalBytes,   setTotalBytes]   = useState(0)
  const [fetchDone,    setFetchDone]    = useState(false)
  const [fetchError,   setFetchError]   = useState(false)
  const [showLoader,   setShowLoader]   = useState(true)
  const [elapsed,      setElapsed]      = useState(0)

  // Scrubber ready (video started)
  const [scrubReady, setScrubReady] = useState(false)

  // ─── Seek ──────────────────────────────────────────────────────────────────
  function seekTo(video: HTMLVideoElement, t: number) {
    const dur = video.duration
    if (!dur) return
    const clamped = Math.max(0, Math.min(dur, t))
    if (video.seeking) return
    if (Math.abs(clamped - lastSetRef.current) < MIN_DELTA_S) return
    lastSetRef.current = clamped
    seekTsRef.current.set(clamped, performance.now())
    video.currentTime = clamped
  }

  function onSeeked() {
    const video = videoRef.current
    if (!video) return
    const now = performance.now()
    seekTsRef.current.forEach((start, t) => {
      if (Math.abs(t - video.currentTime) < 0.05) {
        const lat = now - start
        seekLatsRef.current.push(lat)
        if (lat > SLOW_SEEK_MS) slowSeeksRef.current++
        if (seekLatsRef.current.length > SEEK_HIST) seekLatsRef.current.shift()
        seekTsRef.current.delete(t)
      }
    })
  }

  // ─── Backdrop ──────────────────────────────────────────────────────────────
  function handleBackdrop(speed: number) {
    const fast = speed > FAST_SCROLL
    if (fast && !bdOffRef.current) {
      bdOffRef.current = true
      document.documentElement.classList.add('aurora-fast-scroll')
    }
    if (bdTimerRef.current) clearTimeout(bdTimerRef.current)
    if (!fast && bdOffRef.current) {
      bdTimerRef.current = setTimeout(() => {
        bdOffRef.current = false
        document.documentElement.classList.remove('aurora-fast-scroll')
      }, 150)
    }
  }

  // ─── Debug ─────────────────────────────────────────────────────────────────
  function updateDebug() {
    const el = dbgRef.current
    if (!el || !isDebugRef.current) return
    fpsCountRef.current++
    const now = performance.now()
    if (now - fpsLastRef.current >= 500) {
      fpsRef.current = Math.round(fpsCountRef.current * 1000 / (now - fpsLastRef.current))
      fpsCountRef.current = 0
      fpsLastRef.current = now
    }
    const video  = videoRef.current
    const lats   = seekLatsRef.current
    const heap   = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    const heapMB = heap ? (heap.usedJSHeapSize / 1048576).toFixed(1) : 'n/a'
    el.textContent = [
      `src: ${resolveVideoSrc().replace('/city','')} | FPS: ${fpsRef.current} | heap: ${heapMB} MB | load: ${loadTimeRef.current.toFixed(0)} ms`,
      `time: ${video ? video.currentTime.toFixed(3) : '–'} / ${video ? (video.duration||0).toFixed(3) : '–'} s`,
      `target: ${targetRef.current.toFixed(3)} | seeking: ${video?.seeking ?? '–'}`,
      `seek lat: med ${pct(lats,50).toFixed(0)} ms | p95 ${pct(lats,95).toFixed(0)} ms | max ${lats.length?Math.max(...lats).toFixed(0):0} ms | slow: ${slowSeeksRef.current}`,
    ].join('\n')
  }

  // ─── RAF loop ──────────────────────────────────────────────────────────────
  function startLoop() {
    cancelAnimationFrame(rafRef.current)
    lastRafRef.current = performance.now()
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video || !video.duration) return
      const dt    = Math.min((ts - lastRafRef.current) / 1000, 0.1)
      lastRafRef.current = ts
      const target = targetRef.current
      const prev   = currentRef.current
      const delta  = target - prev
      if (Math.abs(delta) < SNAP_S) {
        currentRef.current = target
        seekTo(video, target)
      } else {
        currentRef.current = prev + delta * (1 - Math.exp(-dt * TIME_DECAY))
        seekTo(video, currentRef.current)
      }
      updateDebug()
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  // ─── Video loadeddata ──────────────────────────────────────────────────────
  const onLoadedData = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    loadTimeRef.current = performance.now() - loadStartRef.current

    // If video was ready in under INSTANT_MS (cache hit), skip loader entirely
    if (loadTimeRef.current < INSTANT_MS) {
      setShowLoader(false)
    }

    setScrubReady(true)
    onReady()
    startLoop()

    // Signal loader to begin fade-out
    setFetchDone(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady])

  // ─── Fetch as Blob ─────────────────────────────────────────────────────────
  useEffect(() => {
    const src = resolveVideoSrc()
    const ac  = new AbortController()
    loadStartRef.current = performance.now()

    isDebugRef.current = new URLSearchParams(window.location.search).get('debug') === '1'
    if (dbgRef.current) dbgRef.current.style.display = isDebugRef.current ? 'block' : 'none'

    // Elapsed timer for slow-connection warning
    const elapsedTimer = setInterval(() => {
      setElapsed(performance.now() - loadStartRef.current)
    }, 500)

    // Backdrop CSS
    const style = document.createElement('style')
    style.textContent = `
      .aurora-fast-scroll [style*="backdrop-filter"],
      .aurora-fast-scroll [style*="backdropFilter"] {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    `
    document.head.appendChild(style)

    async function loadVideo() {
      const video = videoRef.current
      if (!video) return
      try {
        const res = await fetch(src, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const total = Number(res.headers.get('Content-Length') || 0)
        setTotalBytes(total)

        const reader = res.body!.getReader()
        const chunks: Uint8Array<ArrayBuffer>[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          setLoadedBytes(received)
        }

        if (ac.signal.aborted) return

        const blob = new Blob(chunks, { type: 'video/mp4' })
        const url  = URL.createObjectURL(blob)
        blobUrlRef.current = url
        video.src = url
        // loadeddata → onLoadedData()

      } catch (err: unknown) {
        if (ac.signal.aborted) return
        console.warn('[Aurora] fetch failed, falling back:', err)
        setFetchError(true)
        // Fallback: set src directly
        const video2 = videoRef.current
        if (video2) video2.src = src
      }
    }

    loadVideo()

    return () => {
      ac.abort()
      clearInterval(elapsedTimer)
      cancelAnimationFrame(rafRef.current)
      startedRef.current = false
      if (bdTimerRef.current) clearTimeout(bdTimerRef.current)
      if (bdOffRef.current) {
        document.documentElement.classList.remove('aurora-fast-scroll')
        bdOffRef.current = false
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (style.parentNode) style.parentNode.removeChild(style)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── ScrollTrigger ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scrubReady) return
    const tid = setTimeout(() => {
      const container = document.getElementById('scroll-container')
      if (!container) return
      const st = ScrollTrigger.create({
        trigger:  container,
        start:    'top top',
        end:      'bottom bottom',
        scrub:    true,
        onUpdate: (self) => {
          const video = videoRef.current
          if (!video || !video.duration) return
          targetRef.current = self.progress * video.duration
          const now = performance.now()
          const dt  = (now - prevTimeRef.current) / 1000
          if (dt > 0) {
            const speed = Math.abs(self.progress - prevProgRef.current) * video.duration / dt
            handleBackdrop(speed)
          }
          prevTimeRef.current = now
          prevProgRef.current = self.progress
        },
      })
      return () => st.kill()
    }, 150)
    return () => clearTimeout(tid)
  }, [scrubReady])

  const progress = totalBytes > 0 ? loadedBytes / totalBytes : 0

  return (
    <>
      {/* Video element */}
      <video
        ref={videoRef}
        muted playsInline preload="auto"
        onLoadedData={onLoadedData}
        onCanPlay={onLoadedData}
        onSeeked={onSeeked}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0,
          width: '100vw', height: '100vh',
          objectFit: 'cover', zIndex: 0,
          display: 'block', pointerEvents: 'none',
        }}
      />

      {/* Loading screen */}
      {showLoader && (
        <LoadingScreen
          progress={progress}
          loaded={loadedBytes}
          total={totalBytes}
          done={fetchDone}
          error={fetchError}
          elapsed={elapsed}
          onHidden={() => setShowLoader(false)}
          onReload={() => window.location.reload()}
        />
      )}

      {/* Debug HUD */}
      <div
        ref={dbgRef}
        style={{
          display: 'none', position: 'fixed',
          bottom: '16px', left: '16px', zIndex: 999,
          fontFamily: 'monospace', fontSize: '11px', color: '#0f0',
          background: 'rgba(0,0,0,0.82)', padding: '8px 12px',
          borderRadius: '4px', whiteSpace: 'pre', lineHeight: 1.6,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
