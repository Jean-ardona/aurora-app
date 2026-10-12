'use client'

import { useRef } from 'react'
import { useReveal } from '@/lib/useReveal'

const STEPS = [
  { label: 'Vision',      active: true  },
  { label: 'Community',   active: false },
  { label: 'Masterplan',  active: false },
  { label: 'First stone', active: false },
]

const LABEL: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.92)',
  textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)',
}

export default function RoadmapSection() {
  const sectionRef = useRef<HTMLElement>(null)
  useReveal(sectionRef, '.road-line', { stagger: 0.1 })

  return (
    <section id="roadmap" ref={sectionRef} style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 85% 70% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', maxWidth: '56rem', width: '100%' }}>

        <div className="road-line" style={{ marginBottom: '3.5rem', opacity: 0 }}>
          <p style={{ ...LABEL, marginBottom: '1rem' }}>TIMELINE</p>
          <h2 style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(2rem, 5vw, 4.5rem)',
            letterSpacing: '-0.02em', lineHeight: 1.1,
            color: '#ffffff', margin: 0,
            textShadow: '0 2px 28px rgba(0,0,0,0.6)',
          }}>
            From model<br />to first stone.
          </h2>
        </div>

        <div className="road-line" style={{ position: 'relative', opacity: 0 }}>
          {/* Horizontal rule */}
          <div style={{
            position: 'absolute', top: '4px', left: 0, right: 0,
            height: '1px', background: 'rgba(255,255,255,0.2)',
          }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
            {STEPS.map((step) => (
              <div key={step.label}>
                <div style={{
                  width: step.active ? '10px' : '7px',
                  height: step.active ? '10px' : '7px',
                  borderRadius: '50%',
                  background: step.active ? '#ffffff' : 'rgba(255,255,255,0.45)',
                  marginBottom: '1.25rem',
                  marginTop: step.active ? '-3px' : '-1px',
                  position: 'relative', zIndex: 1,
                  boxShadow: step.active ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                }} />
                <p style={{
                  fontFamily: step.active ? 'Instrument Serif, serif' : 'Inter, sans-serif',
                  fontSize: step.active ? '1rem' : '0.875rem',
                  fontWeight: 400,
                  color: step.active ? '#ffffff' : 'rgba(255,255,255,0.82)',
                  margin: 0,
                  textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)',
                }}>
                  {step.label}
                </p>
                {step.active && (
                  <p style={{
                    ...LABEL, fontSize: '10px', letterSpacing: '0.2em',
                    color: 'rgba(255,255,255,0.72)', marginTop: '0.4rem',
                  }}>
                    NOW
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
