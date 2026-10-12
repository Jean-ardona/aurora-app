'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.92)',
  textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)',
}

const TITLE_SHADOW = '0 2px 28px rgba(0,0,0,0.6), 0 1px 8px rgba(0,0,0,0.4)'

export default function HeroSection() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.hero-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none' })
      return
    }
    gsap.set(els, { y: 60, opacity: 0 })
    gsap.to(els, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1, ease: 'power3.out', delay: 0.4 })
  }, [])

  return (
    <section id="hero" style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '0 1.5rem', zIndex: 10,
    }}>
      {/* Local text-block scrim — extends 120px beyond the text block */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: '900px', width: '100%' }}>

        <div style={{ overflow: 'hidden', marginBottom: '2rem' }}>
          <span className="hero-reveal" style={{ display: 'block', ...LABEL_STYLE }}>
            A CITY THAT DOES NOT EXIST YET
          </span>
        </div>

        <div style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
          <h1 className="hero-reveal" style={{
            display: 'block',
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(4rem, 14vw, 12rem)',
            letterSpacing: '-0.04em', lineHeight: 0.9,
            color: '#ffffff', margin: 0,
            textShadow: TITLE_SHADOW,
          }}>
            AURORA
          </h1>
        </div>

        <div style={{ overflow: 'hidden', marginBottom: '4rem' }}>
          <p className="hero-reveal" style={{
            display: 'block',
            fontFamily: 'Instrument Serif, serif',
            fontSize: 'clamp(1.1rem, 2.5vw, 1.75rem)',
            color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', margin: 0,
            textShadow: '0 2px 28px rgba(0,0,0,0.6)',
          }}>
            Built with the people who will live in it.
          </p>
        </div>

        <div className="hero-reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...LABEL_STYLE, fontSize: '10px', letterSpacing: '0.3em' }}>Scroll</span>
          <ScrollLine />
        </div>
      </div>
    </section>
  )
}

function ScrollLine() {
  const lineRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const line = lineRef.current
    if (!line || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(line,
      { scaleY: 0, transformOrigin: 'top center' },
      { scaleY: 1, duration: 1.2, ease: 'power2.inOut', repeat: -1, yoyo: true, delay: 1.8 }
    )
  }, [])
  return <div ref={lineRef} style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.4)' }} />
}
