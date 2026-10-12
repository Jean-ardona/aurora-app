'use client'

import { useRef } from 'react'
import { useAuroraStore } from '@/lib/store'
import { useReveal } from '@/lib/useReveal'

const LABEL: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.92)',
  textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)',
}

export default function ModelSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { choices } = useAuroraStore()
  useReveal(sectionRef, '.model-line', { stagger: 0.1 })

  return (
    <section id="model" ref={sectionRef} style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 75% 65% at 50% 55%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', maxWidth: '36rem', width: '100%' }}>

        <p className="model-line" style={{ ...LABEL, marginBottom: '2rem', opacity: 0 }}>
          THE MODEL
        </p>

        <p className="model-line" style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', lineHeight: 1.35,
          color: '#ffffff', marginBottom: '3rem', opacity: 0,
          textShadow: '0 2px 28px rgba(0,0,0,0.6)',
        }}>
          This is Aurora today.{' '}
          <span style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
            Grey. Silent. Waiting for its first residents.
          </span>
        </p>

        <div className="model-line" style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', opacity: 0 }}>
          <Stat value={choices.length} label="residents" />
          <Stat value={4}              label="districts" />
          <Stat value="Day 1"          label="" />
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p style={{
        fontFamily: 'Instrument Serif, serif', fontSize: '2.5rem',
        color: '#ffffff', lineHeight: 1, marginBottom: '0.25rem',
        textShadow: '0 2px 16px rgba(0,0,0,0.5)',
      }}>
        {value}
      </p>
      {label && (
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.72)',
          textShadow: '0 1px 12px rgba(0,0,0,0.65)',
        }}>
          {label}
        </p>
      )}
    </div>
  )
}
