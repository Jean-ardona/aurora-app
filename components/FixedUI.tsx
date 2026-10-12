'use client'

import { useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function FixedUI() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const trigger = document.getElementById('scroll-container')
      if (!trigger) return
      const st = ScrollTrigger.create({
        trigger,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => setProgress(self.progress),
      })
      return () => st.kill()
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      {/* ── AURORA wordmark (top-left) ──────────────────────────────────────
          Plain white #FFFFFF with text-shadow — visible on both bright sky
          frames and dark interior frames, no blend-mode side effects.       */}
      <div style={{
        position: 'fixed', top: '24px', left: '24px', zIndex: 50,
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: '#FFFFFF',
        textShadow: '0 1px 14px rgba(0,0,0,0.7)',
        pointerEvents: 'none',
      }}>
        AURORA
      </div>

      {/* ── Scroll progress (top-right) ─────────────────────────────────────
          Same treatment — white with shadow, no mix-blend-mode.            */}
      <div style={{
        position: 'fixed', top: '24px', right: '24px', zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '10px',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '40px', height: '1px',
          background: 'rgba(255,255,255,0.35)', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '1px',
            width: `${progress * 100}%`,
            background: '#ffffff',
            transition: 'width 0.08s linear',
          }} />
        </div>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500,
          letterSpacing: '0.08em', color: '#FFFFFF',
          textShadow: '0 1px 14px rgba(0,0,0,0.7)',
        }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
    </>
  )
}
