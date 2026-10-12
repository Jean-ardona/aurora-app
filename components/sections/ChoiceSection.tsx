'use client'

import { useRef } from 'react'
import { useAuroraStore, type Priority } from '@/lib/store'
import { useReveal } from '@/lib/useReveal'
import { PRIORITY_LABELS, PRIORITY_DESCRIPTIONS, PRIORITY_ICONS, PRIORITY_ACCENT } from '@/lib/colorSystem'

const PRIORITIES: Priority[] = ['housing', 'nature', 'mobility', 'culture']

const LABEL: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.92)',
  textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)',
}

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '0.75rem 2rem', borderRadius: '9999px',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(10,10,10,0.55)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
  fontWeight: 400, letterSpacing: '0.05em', cursor: 'pointer',
  transition: 'background 300ms ease, color 300ms ease, border-color 300ms ease',
  textShadow: '0 1px 8px rgba(0,0,0,0.4)',
}

export default function ChoiceSection({ onContinue }: { onContinue: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const { choices, lifeScore, toggleChoice } = useAuroraStore()
  useReveal(sectionRef, '.choice-line', { stagger: 0.08 })

  return (
    <section id="choice" ref={sectionRef} style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '3rem 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 80% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', maxWidth: '56rem', width: '100%' }}>

        {/* Header */}
        <div className="choice-line" style={{ textAlign: 'center', marginBottom: '3rem', opacity: 0 }}>
          <p style={{ ...LABEL, marginBottom: '1rem' }}>SHAPE THE CITY</p>
          <h2 style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(2rem, 5vw, 4.5rem)',
            letterSpacing: '-0.02em', lineHeight: 1.1,
            color: '#ffffff', margin: 0,
            textShadow: '0 2px 28px rgba(0,0,0,0.6)',
          }}>
            What should Aurora be?
          </h2>
        </div>

        {/* Cards grid */}
        <div className="choice-line" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem', marginBottom: '3rem', opacity: 0,
        }}>
          {PRIORITIES.map((p) => (
            <PriorityCard key={p} priority={p} selected={choices.includes(p)} onToggle={() => toggleChoice(p)} />
          ))}
        </div>

        {/* Gauge + Continue */}
        <div className="choice-line" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', opacity: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ ...LABEL, fontSize: '10px', letterSpacing: '0.2em' }}>LIFE</span>
            <div style={{ width: '120px', height: '1px', background: 'rgba(255,255,255,0.15)', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '1px',
                width: `${lifeScore}%`,
                background: `hsl(var(--tint-hue, 35), 80%, 65%)`,
                transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500,
              color: 'rgba(255,255,255,0.72)',
              textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            }}>
              {lifeScore}%
            </span>
          </div>

          <button
            onClick={onContinue}
            disabled={choices.length === 0}
            aria-label="Continue to next section"
            style={{
              ...BTN_BASE,
              cursor: choices.length === 0 ? 'not-allowed' : 'pointer',
              opacity: choices.length === 0 ? 0.35 : 1,
            }}
            onMouseEnter={(e) => {
              if (choices.length === 0) return
              const t = e.currentTarget
              t.style.background = '#ffffff'
              t.style.color = '#0A0A0A'
              t.style.textShadow = 'none'
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget
              t.style.background = 'rgba(10,10,10,0.55)'
              t.style.color = '#ffffff'
              t.style.textShadow = '0 1px 8px rgba(0,0,0,0.4)'
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </section>
  )
}

function PriorityCard({ priority, selected, onToggle }: {
  priority: Priority; selected: boolean; onToggle: () => void
}) {
  const accent = PRIORITY_ACCENT[priority]
  return (
    <button
      role="button" aria-pressed={selected} onClick={onToggle}
      style={{
        background: selected ? 'rgba(10,10,10,0.6)' : 'rgba(10,10,10,0.55)',
        border: `1px solid ${selected ? accent : 'rgba(255,255,255,0.18)'}`,
        borderRadius: '4px', padding: '1.75rem 1.5rem',
        cursor: 'pointer', textAlign: 'left',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        transition: 'border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease',
        boxShadow: selected ? `0 0 24px ${accent}35` : 'none',
        color: '#ffffff', width: '100%',
      }}
    >
      <div style={{
        fontSize: '1.4rem', marginBottom: '1rem', lineHeight: 1,
        color: selected ? accent : 'rgba(255,255,255,0.45)',
        transition: 'color 0.3s',
      }}>
        {PRIORITY_ICONS[priority]}
      </div>
      <p style={{
        fontFamily: 'Instrument Serif, serif', fontSize: '1.2rem', marginBottom: '0.5rem',
        color: '#ffffff',
        textShadow: '0 1px 8px rgba(0,0,0,0.4)',
      }}>
        {PRIORITY_LABELS[priority]}
      </p>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 400,
        color: 'rgba(255,255,255,0.72)', lineHeight: 1.5,
        textShadow: '0 1px 6px rgba(0,0,0,0.5)',
      }}>
        {PRIORITY_DESCRIPTIONS[priority]}
      </p>
      {selected && <div style={{ marginTop: '1rem', width: '16px', height: '1px', background: accent }} />}
    </button>
  )
}
