'use client'

/**
 * /loader-preview — visual test page for LoadingScreen.
 * Simulates a 12 MB download over ~8 seconds so you can see
 * the full animation: sun rise, progress bar, message rotation,
 * slow-connection warning, then fade-out.
 *
 * Visit: http://localhost:3000/loader-preview
 * Visit: http://localhost:3000/loader-preview?speed=fast  (2 seconds)
 * Visit: http://localhost:3000/loader-preview?speed=slow  (20 seconds, shows warning)
 * Visit: http://localhost:3000/loader-preview?error=1     (shows error state)
 * Visit: http://localhost:3000/loader-preview?no-content  (indeterminate, no Content-Length)
 */

import { useEffect, useState } from 'react'
import LoadingScreen from '@/components/LoadingScreen'

const TOTAL_BYTES = 12.31 * 1024 * 1024  // 12.31 MB

export default function LoaderPreview() {
  const [loaded,   setLoaded]   = useState(0)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState(false)
  const [elapsed,  setElapsed]  = useState(0)
  const [hidden,   setHidden]   = useState(false)
  const [noContent, setNoContent] = useState(false)
  const [speed, setSpeed] = useState<'fast' | 'normal' | 'slow'>('normal')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sp = params.get('speed')
    if (sp === 'fast') setSpeed('fast')
    else if (sp === 'slow') setSpeed('slow')
    if (params.has('error')) setError(true)
    if (params.has('no-content')) setNoContent(true)
  }, [])

  // Simulate download
  useEffect(() => {
    if (error) return
    const duration = speed === 'fast' ? 2000 : speed === 'slow' ? 20000 : 8000
    const start    = performance.now()
    let raf = 0

    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1)
      // Slightly non-linear to feel more like a real download
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      setLoaded(eased * TOTAL_BYTES)
      setElapsed(performance.now() - start)

      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setLoaded(TOTAL_BYTES)
        // Small pause then mark done (simulates video loadeddata)
        setTimeout(() => setDone(true), 200)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed, error])

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 500), 500)
    return () => clearInterval(id)
  }, [])

  if (hidden) {
    return (
      <div style={{
        background: '#0a0a0a', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#F5F5F2', fontFamily: 'Inter, sans-serif', fontSize: '14px',
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ opacity: 0.6, letterSpacing: '0.1em' }}>Loader hidden — site would appear here.</p>
          <button
            onClick={() => {
              setHidden(false); setLoaded(0); setDone(false); setElapsed(0)
            }}
            style={{
              padding: '8px 20px', borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent', color: '#fff',
              cursor: 'pointer', fontFamily: 'Inter', fontSize: '12px',
              letterSpacing: '0.1em',
            }}
          >
            Replay
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Dark background so the loader looks correct */}
      <div style={{ background: '#0a0a0a', minHeight: '100vh' }} />

      <LoadingScreen
        progress={noContent ? 0 : Math.min(loaded / TOTAL_BYTES, 1)}
        loaded={loaded}
        total={noContent ? 0 : TOTAL_BYTES}
        done={done}
        error={error}
        elapsed={elapsed}
        onHidden={() => setHidden(true)}
        onReload={() => window.location.reload()}
      />
    </>
  )
}
