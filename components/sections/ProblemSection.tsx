'use client'

import { useRef } from 'react'
import { useReveal } from '@/lib/useReveal'

const lines = [
  { text: 'Cities grow fast.',           muted: true,  italic: false },
  { text: 'They are rarely asked',       muted: true,  italic: false },
  { text: 'what they should become.',    muted: true,  italic: false },
  { text: 'Aurora starts differently.',  muted: false, italic: true  },
]

export default function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null)
  useReveal(sectionRef, '.prob-line', { stagger: 0.12 })

  return (
    <section id="problem" ref={sectionRef} style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '0 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', maxWidth: '36rem', width: '100%' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ overflow: 'hidden', marginBottom: '0.4rem' }}>
            <p className="prob-line" style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: 'clamp(2rem, 5vw, 4.5rem)',
              letterSpacing: '-0.02em', lineHeight: 1.1,
              color: line.muted ? 'rgba(255,255,255,0.78)' : '#ffffff',
              fontStyle: line.italic ? 'italic' : 'normal',
              margin: 0, opacity: 0,
              textShadow: '0 2px 28px rgba(0,0,0,0.6), 0 1px 8px rgba(0,0,0,0.4)',
            }}>
              {line.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
