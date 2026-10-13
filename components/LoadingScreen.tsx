'use client'

/**
 * LoadingScreen — full-screen loader driven by video fetch byte progress.
 *
 * Layout (matches "Loading screen 47%" artboard):
 *   - Background: radial gradient dark brown → near-black
 *   - AURORA wordmark top-left
 *   - Center: sun rising above a horizon line
 *   - Horizon: 420px wide 1px rule + glowing progress segment (scaleX)
 *   - Below: large percentage, rotating italic message, loaded/total MB
 *   - Bottom: MODEL 001 / LOADING THE MODEL
 *
 * Accessibility: role="progressbar", aria-valuenow, announces every 25%.
 * prefers-reduced-motion: static message, numeric progress only, no rotation.
 * Body scroll locked while visible.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'

const MESSAGES = [
  'Surveying the land...',
  'Drawing the first streets...',
  'Placing four districts...',
  'Waiting for the first residents...',
]

const SLOW_THRESHOLD_MS = 8000

interface LoadingScreenProps {
  /** 0–1, based on fetch bytes / Content-Length */
  progress: number
  /** bytes loaded so far */
  loaded: number
  /** total bytes (0 = unknown / indeterminate) */
  total: number
  /** true when fetch+video init succeeded */
  done: boolean
  /** true if fetch threw a non-abort error */
  error: boolean
  /** called when the fade-out finishes */
  onHidden: () => void
  /** how long since fetch started (ms) */
  elapsed: number
  onReload: () => void
}

export default function LoadingScreen({
  progress, loaded, total, done, error,
  onHidden, elapsed, onReload,
}: LoadingScreenProps) {
  const reducedMotion   = useRef(false)
  const rootRef         = useRef<HTMLDivElement>(null)
  const sunRef          = useRef<HTMLDivElement>(null)
  const barFillRef      = useRef<HTMLDivElement>(null)
  const horizonRef      = useRef<HTMLDivElement>(null)
  const msgRef          = useRef<HTMLParagraphElement>(null)
  const msgIdxRef       = useRef(0)
  const announceRef     = useRef(0)   // last announced 25% bucket
  const indetermTweenRef = useRef<gsap.core.Tween | null>(null)
  const [visible, setVisible]   = useState(true)
  const [msgText, setMsgText]   = useState(MESSAGES[0])
  const [msgOpacity, setMsgOpacity] = useState(1)

  const isIndeterminate = total === 0
  const pct = Math.round(progress * 100)
  const loadedMB = (loaded / 1048576).toFixed(1)
  const totalMB  = total ? (total / 1048576).toFixed(1) : '?'

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  // ── Reduced motion check ──────────────────────────────────────────────────
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // ── Sun position driven by progress ──────────────────────────────────────
  // Sun starts fully hidden below the horizon (translateY = 80px = full circle height)
  // At 100% it's at translateY = 0 (half disc visible above horizon)
  useEffect(() => {
    if (!sunRef.current) return
    if (reducedMotion.current) return

    if (isIndeterminate) {
      // Indeterminate: slow oscillation
      indetermTweenRef.current?.kill()
      indetermTweenRef.current = gsap.to(sunRef.current, {
        y: 20,
        duration: 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      })
      return
    }

    // Kill indeterminate tween if it was running
    indetermTweenRef.current?.kill()
    indetermTweenRef.current = null

    // translateY: 80 → 0 as progress goes 0 → 1
    const y = 80 * (1 - progress)
    gsap.to(sunRef.current, { y, duration: 0.4, ease: 'power2.out' })
  }, [progress, isIndeterminate])

  // ── Progress bar (scaleX on fill element) ────────────────────────────────
  useEffect(() => {
    if (!barFillRef.current) return
    gsap.to(barFillRef.current, {
      scaleX: isIndeterminate ? 0 : progress,
      duration: 0.3,
      ease: 'power2.out',
    })
  }, [progress, isIndeterminate])

  // ── Message rotation every 3s ─────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion.current) return
    const interval = setInterval(() => {
      // Fade out
      setMsgOpacity(0)
      setTimeout(() => {
        msgIdxRef.current = (msgIdxRef.current + 1) % MESSAGES.length
        setMsgText(MESSAGES[msgIdxRef.current])
        setMsgOpacity(1)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // ── Accessibility: announce every 25% ─────────────────────────────────────
  useEffect(() => {
    const bucket = Math.floor(pct / 25) * 25
    if (bucket > announceRef.current && bucket <= 100) {
      announceRef.current = bucket
      // aria-live will pick this up automatically from aria-valuenow
    }
  }, [pct])

  // ── Done: brighten horizon then fade out ──────────────────────────────────
  const startFadeOut = useCallback(() => {
    const root = rootRef.current
    const hor  = horizonRef.current
    if (!root || !hor) { onHidden(); return }

    // Brighten horizon for 300ms
    gsap.to(hor, {
      opacity: 1,
      boxShadow: '0 0 20px 4px rgba(243,217,184,0.7)',
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        // Fade out loader over 600ms
        gsap.to(root, {
          opacity: 0,
          duration: 0.6,
          ease: 'power2.in',
          onComplete: () => {
            setVisible(false)
            onHidden()
          },
        })
      },
    })
  }, [onHidden])

  useEffect(() => {
    if (done) startFadeOut()
  }, [done, startFadeOut])

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      role="progressbar"
      aria-label="Loading Aurora city model"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isIndeterminate ? undefined : pct}
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     200,
        background: 'radial-gradient(ellipse at 50% 55%, #17120e, #0a0a0a 65%)',
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow:   'hidden',
        userSelect: 'none',
      }}
    >
      {/* AURORA wordmark — top left */}
      <div style={{
        position:      'absolute',
        top:           '24px',
        left:          '24px',
        fontFamily:    'Inter, sans-serif',
        fontSize:      '13px',
        fontWeight:    600,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color:         '#ffffff',
        textShadow:    '0 1px 14px rgba(0,0,0,0.7)',
      }}>
        AURORA
      </div>

      {/* Bottom label */}
      <div style={{
        position:      'absolute',
        bottom:        '32px',
        left:          '50%',
        transform:     'translateX(-50%)',
        fontFamily:    'Inter, sans-serif',
        fontSize:      '11px',
        fontWeight:    400,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color:         'rgba(255,255,255,0.6)',
        whiteSpace:    'nowrap',
      }}>
        MODEL 001 / LOADING THE MODEL
      </div>

      {/* ── Center group ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/*
          Sun assembly.
          Strategy: wrap in a box that clips ONLY the bottom half
          (below the horizon), so the glow can radiate freely upward
          and to the sides. We achieve this with:
            - outer container: overflow visible, just positions things
            - inner mask: only hides content below the horizon line
              using clipPath that leaves the top fully open
        */}
        <div style={{
          width:        '200px',
          height:       '80px',        // exactly one circle-radius tall
          position:     'relative',
          marginBottom: '-1px',        // flush against horizon
          overflow:     'visible',     // glow bleeds upward freely
          // Clip: hide everything BELOW the bottom edge of this box,
          // keep everything above fully visible (including glow)
          clipPath:     'inset(-200px -200px 0 -200px)', // open top/sides, clip bottom only
        }}>
          <div
            ref={sunRef}
            style={{
              position:     'absolute',
              bottom:       '0px',
              left:         '50%',
              marginLeft:   '-40px',
              width:        '80px',
              height:       '80px',
              borderRadius: '50%',
              background:   'linear-gradient(180deg, #f6e2c6 0%, #d9a679 100%)',
              boxShadow:    '0 0 50px 14px rgba(243,200,150,0.5), 0 0 100px 30px rgba(243,180,120,0.22)',
              transform:    'translateY(80px)',  // start fully hidden below horizon
            }}
          />
        </div>

        {/* Horizon line + progress segment */}
        <div style={{ position: 'relative', width: '420px', height: '3px' }}>
          {/* Base line (1px) */}
          <div
            ref={horizonRef}
            style={{
              position:  'absolute',
              top:       '1px',
              left:      0,
              right:     0,
              height:    '1px',
              background: 'rgba(255,255,255,0.28)',
            }}
          />
          {/* Progress glow segment */}
          <div
            ref={barFillRef}
            style={{
              position:       'absolute',
              top:            0,
              left:           0,
              width:          '100%',
              height:         '3px',
              background:     '#f3d9b8',
              boxShadow:      '0 0 8px 2px rgba(243,217,184,0.6)',
              transformOrigin: 'left center',
              transform:      'scaleX(0)',
            }}
          />
        </div>

        {/* Percentage + message + size */}
        <div style={{
          marginTop:  '40px',
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap:        '16px',
        }}>

          {/* Percentage — hide in indeterminate */}
          {!isIndeterminate && !reducedMotion.current && (
            <div style={{
              display:    'flex',
              alignItems: 'baseline',
              gap:        '4px',
              fontFamily: 'Instrument Serif, serif',
              color:      '#F5F5F2',
              lineHeight: 1,
            }}>
              <span style={{ fontSize: '96px', letterSpacing: '-0.04em' }}>{pct}</span>
              <span style={{ fontSize: '36px' }}>%</span>
            </div>
          )}

          {/* Rotating italic message */}
          {!reducedMotion.current ? (
            <p
              ref={msgRef}
              style={{
                fontFamily:    'Instrument Serif, serif',
                fontSize:      '26px',
                fontStyle:     'italic',
                color:         'rgba(245,242,235,0.7)',
                margin:        0,
                opacity:       msgOpacity,
                transition:    'opacity 0.3s ease',
                whiteSpace:    'nowrap',
              }}
            >
              {msgText}
            </p>
          ) : (
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize:   '14px',
              color:      'rgba(245,242,235,0.6)',
              margin:     0,
            }}>
              Loading… {isIndeterminate ? '' : `${pct}%`}
            </p>
          )}

          {/* Loaded size */}
          <p style={{
            fontFamily:    'Inter, sans-serif',
            fontSize:      '11px',
            fontWeight:    400,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.35)',
            margin:        0,
          }}>
            {loadedMB} / {totalMB} MB
          </p>

          {/* Slow connection warning */}
          {elapsed > SLOW_THRESHOLD_MS && !error && (
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize:   '11px',
              color:      'rgba(255,255,255,0.35)',
              margin:     0,
              textAlign:  'center',
            }}>
              Slow connection. The model is {totalMB} MB, almost there.
            </p>
          )}

          {/* Error state */}
          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize:   '13px',
                color:      'rgba(255,180,180,0.85)',
                margin:     0,
                textAlign:  'center',
              }}>
                Could not load the model. Reload to try again.
              </p>
              <button
                onClick={onReload}
                style={{
                  fontFamily:    'Inter, sans-serif',
                  fontSize:      '12px',
                  fontWeight:    500,
                  letterSpacing: '0.1em',
                  padding:       '8px 20px',
                  borderRadius:  '9999px',
                  border:        '1px solid rgba(255,255,255,0.25)',
                  background:    'transparent',
                  color:         '#ffffff',
                  cursor:        'pointer',
                }}
              >
                Reload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
