'use client'

import { useRef, useState } from 'react'
import { useAuroraStore } from '@/lib/store'
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

export default function JoinSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { joinedWaitlist, waitlistCount, joinWaitlist } = useAuroraStore()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  useReveal(sectionRef, '.join-line', { stagger: 0.1 })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    joinWaitlist()
  }

  const residentNumber = String(waitlistCount).padStart(4, '0')

  return (
    <section id="join" ref={sectionRef} style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      minHeight: '100vh', padding: '4rem 1.5rem 3rem', zIndex: 10,
    }}>
      {/* Local text-block scrim */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 72% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{
        position: 'relative', maxWidth: '36rem', width: '100%',
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {!joinedWaitlist ? (
          <>
            <div className="join-line" style={{ textAlign: 'center', marginBottom: '3rem', opacity: 0 }}>
              <h2 style={{
                fontFamily: 'Instrument Serif, serif',
                fontSize: 'clamp(2rem, 5vw, 4.5rem)',
                letterSpacing: '-0.02em', lineHeight: 1.1,
                color: '#ffffff', marginBottom: '1rem',
                textShadow: '0 2px 28px rgba(0,0,0,0.6)',
              }}>
                Be a founding resident.
              </h2>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 300,
                color: 'rgba(255,255,255,0.82)', lineHeight: 1.7,
                maxWidth: '28rem', margin: '0 auto',
                textShadow: '0 1px 12px rgba(0,0,0,0.5)',
              }}>
                Aurora is looking for its first residents. People who want to shape a city, not just live in one.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="join-line"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', opacity: 0 }}
              noValidate
            >
              <div style={{ width: '100%', maxWidth: '380px' }}>
                <input
                  type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  placeholder="your@email.com"
                  aria-label="Email address"
                  aria-describedby={error ? 'email-error' : undefined}
                  style={{
                    width: '100%',
                    background: 'rgba(10,10,10,0.55)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    border: `1px solid ${error ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '4px', padding: '0.85rem 1.25rem',
                    color: '#ffffff', fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9rem', fontWeight: 300, outline: 'none',
                    transition: 'border-color 0.3s ease',
                  }}
                  onFocus={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.5)')}
                  onBlur={(e)   => (e.target.style.borderColor = error ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.2)')}
                />
                {error && (
                  <p id="email-error" role="alert" style={{
                    fontFamily: 'Inter, sans-serif', color: 'rgba(255,140,140,0.9)',
                    fontSize: '12px', marginTop: '0.4rem',
                    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                  }}>
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit" style={BTN_BASE}
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
                Join the founding community
              </button>
            </form>
          </>
        ) : (
          <div className="join-line" style={{ textAlign: 'center', opacity: 0 }}>
            <p style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              color: '#ffffff', marginBottom: '1rem', fontStyle: 'italic',
              textShadow: '0 2px 28px rgba(0,0,0,0.6)',
            }}>
              Welcome.
            </p>
            <p style={{
              ...LABEL, letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.82)',
            }}>
              You are resident number {residentNumber}.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="join-line" style={{ position: 'relative', textAlign: 'center', paddingTop: '3rem', opacity: 0 }}>
        <p style={{
          ...LABEL, fontSize: '10px', letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.82)',
        }}>
          Aurora is a concept. The model is the beginning.
        </p>
      </div>
    </section>
  )
}
