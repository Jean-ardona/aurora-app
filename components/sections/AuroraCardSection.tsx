'use client'

import { useRef, useState } from 'react'
import { useAuroraStore } from '@/lib/store'
import { generateAuroraLine, PRIORITY_LABELS, PRIORITY_ACCENT } from '@/lib/colorSystem'
import { useReveal } from '@/lib/useReveal'

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
  transition: 'background 300ms ease, color 300ms ease',
  textShadow: '0 1px 8px rgba(0,0,0,0.4)',
}

export default function AuroraCardSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { choices, lifeScore } = useAuroraStore()
  const [toastVisible, setToastVisible] = useState(false)
  useReveal(sectionRef, '.card-line', { stagger: 0.1 })

  const auroraLine = generateAuroraLine(choices)

  const handleShare = async () => {
    const text = `My Aurora — ${auroraLine}\nPriorities: ${choices.map((c) => PRIORITY_LABELS[c]).join(', ')}\nLife score: ${lifeScore}%\nauroracity.earth`
    try { await navigator.clipboard.writeText(text) } catch {}
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2800)
  }

  return (
    <section id="your-aurora" ref={sectionRef} style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', maxWidth: '36rem', width: '100%' }}>

        <p className="card-line" style={{ ...LABEL, marginBottom: '1.5rem', opacity: 0 }}>
          YOUR AURORA
        </p>

        {/* Card — rgba(10,10,10,0.55) + heavy blur so city shows around it */}
        <div className="card-line" style={{
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '4px', padding: '2.5rem',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          background: 'rgba(10,10,10,0.55)',
          marginBottom: '2rem', opacity: 0,
        }}>
          <p style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
            color: '#ffffff', lineHeight: 1.35, marginBottom: '2rem', fontStyle: 'italic',
            textShadow: '0 2px 16px rgba(0,0,0,0.5)',
          }}>
            &ldquo;{auroraLine}&rdquo;
          </p>

          {choices.length > 0 ? (
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ ...LABEL, fontSize: '11px', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>
                YOUR PRIORITIES
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {choices.map((c) => (
                  <span key={c} style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400,
                    color: 'rgba(255,255,255,0.9)',
                    border: `1px solid ${PRIORITY_ACCENT[c]}`,
                    borderRadius: '9999px', padding: '0.3rem 0.85rem',
                    textShadow: '0 1px 6px rgba(0,0,0,0.4)',
                  }}>
                    {PRIORITY_LABELS[c]}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.5)', marginBottom: '2rem',
            }}>
              No priorities selected yet.
            </p>
          )}

          {choices.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ ...LABEL, fontSize: '11px', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>
                YOUR PALETTE
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {choices.map((c) => (
                  <div key={c} style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: PRIORITY_ACCENT[c],
                    boxShadow: `0 0 8px ${PRIORITY_ACCENT[c]}60`,
                  }} title={PRIORITY_LABELS[c]} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{
              fontFamily: 'Instrument Serif, serif', fontSize: '3rem',
              color: '#ffffff', lineHeight: 1,
              textShadow: '0 2px 16px rgba(0,0,0,0.5)',
            }}>
              {lifeScore}
            </span>
            <span style={{ ...LABEL, fontSize: '11px' }}>% LIFE</span>
          </div>
        </div>

        {/* Share button */}
        <div className="card-line" style={{ opacity: 0 }}>
          <button
            onClick={handleShare}
            style={BTN_BASE}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.color = '#0A0A0A'
              e.currentTarget.style.textShadow = 'none'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(10,10,10,0.55)'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.textShadow = '0 1px 8px rgba(0,0,0,0.4)'
            }}
          >
            Share my Aurora
          </button>
        </div>
      </div>

      {/* Toast */}
      <div aria-live="polite" aria-atomic="true" style={{
        position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.18)', borderRadius: '9999px',
        padding: '0.6rem 1.5rem',
        fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.92)',
        zIndex: 200, opacity: toastVisible ? 1 : 0,
        transition: 'opacity 0.3s ease', pointerEvents: 'none',
      }}>
        Copied to clipboard
      </div>
    </section>
  )
}
