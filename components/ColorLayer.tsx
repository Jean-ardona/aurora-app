'use client'

/**
 * ColorLayer — 4 zone-based transparent layers that blend over the B&W canvas.
 *
 * Zones (from top to bottom of viewport):
 *  1. Sky      top 40%     warm amber/rose   mix-blend-mode: soft-light
 *  2. Facade   full        teal/blue tint    mix-blend-mode: color     max 0.6
 *  3. Ground   bottom 25%  warm street glow  mix-blend-mode: overlay
 *  4. Accents  left+right  magenta blobs     mix-blend-mode: soft-light
 *
 * Active priorities influence which zones and what hue:
 *  housing  → warm amber  (sky + ground strong)
 *  nature   → green/teal  (facade strong)
 *  mobility → electric blue (facade + ground)
 *  culture  → magenta     (accents strong)
 *
 * All animated via GSAP tweening individual CSS variables on :root.
 * Opacities are set directly as numeric style props — no CSS calc().
 *
 * This component is position:fixed, z-index:1, pointer-events:none.
 * It must be a sibling of the canvas (same stacking context, no isolation).
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useAuroraStore, type Priority } from '@/lib/store'

// Per-priority contributions to each zone
const ZONE_CONFIG: Record<Priority, {
  skyHue: number;   skyStr: number
  facadeHue: number; facadeStr: number
  groundHue: number; groundStr: number
  accentHue: number; accentStr: number
}> = {
  housing:  { skyHue: 35,  skyStr: 0.9,  facadeHue: 30,  facadeStr: 0.2, groundHue: 40,  groundStr: 0.8, accentHue: 30,  accentStr: 0.1 },
  nature:   { skyHue: 160, skyStr: 0.3,  facadeHue: 165, facadeStr: 0.9, groundHue: 145, groundStr: 0.3, accentHue: 155, accentStr: 0.2 },
  mobility: { skyHue: 210, skyStr: 0.3,  facadeHue: 210, facadeStr: 0.8, groundHue: 200, groundStr: 0.6, accentHue: 215, accentStr: 0.15 },
  culture:  { skyHue: 300, skyStr: 0.4,  facadeHue: 295, facadeStr: 0.4, groundHue: 305, groundStr: 0.3, accentHue: 300, accentStr: 0.95 },
}

function blendZone(choices: Priority[], zone: 'sky' | 'facade' | 'ground' | 'accent') {
  if (choices.length === 0) return { hue: 35, str: 0 }
  let hueSum = 0, strSum = 0
  choices.forEach((p) => {
    hueSum += ZONE_CONFIG[p][`${zone}Hue`]
    strSum += ZONE_CONFIG[p][`${zone}Str`]
  })
  return {
    hue: hueSum / choices.length,
    str: Math.min(strSum / choices.length, zone === 'facade' ? 0.6 : 0.85),
  }
}

export default function ColorLayer() {
  const { choices, lifeScore } = useAuroraStore()

  // Refs to the 4 zone divs — we tween their opacity directly
  const skyRef    = useRef<HTMLDivElement>(null)
  const facadeRef = useRef<HTMLDivElement>(null)
  const groundRef = useRef<HTMLDivElement>(null)
  const accLRef   = useRef<HTMLDivElement>(null)
  const accRRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lifeScore === 0) {
      // Fade everything out
      ;[skyRef, facadeRef, groundRef, accLRef, accRRef].forEach((r) => {
        if (r.current) gsap.to(r.current, { opacity: 0, duration: 1.2, ease: 'power2.out' })
      })
      return
    }

    const globalScale = lifeScore / 100

    const sky    = blendZone(choices, 'sky')
    const facade = blendZone(choices, 'facade')
    const ground = blendZone(choices, 'ground')
    const accent = blendZone(choices, 'accent')

    // Sky
    if (skyRef.current) {
      skyRef.current.style.background =
        `radial-gradient(ellipse 100% 55% at 50% 0%, hsl(${sky.hue}, 90%, 62%) 0%, hsl(${sky.hue + 15}, 80%, 50%) 45%, transparent 75%)`
      gsap.to(skyRef.current, { opacity: sky.str * globalScale, duration: 1.2, ease: 'power2.out' })
    }

    // Facade
    if (facadeRef.current) {
      facadeRef.current.style.background =
        `linear-gradient(170deg, hsl(${facade.hue + 20}, 75%, 40%) 0%, hsl(${facade.hue - 15}, 70%, 35%) 100%)`
      gsap.to(facadeRef.current, { opacity: facade.str * globalScale, duration: 1.2, ease: 'power2.out' })
    }

    // Ground
    if (groundRef.current) {
      groundRef.current.style.background =
        `radial-gradient(ellipse 80% 60% at 50% 120%, hsl(${ground.hue}, 95%, 65%) 0%, hsl(${ground.hue + 10}, 80%, 55%) 40%, transparent 70%)`
      gsap.to(groundRef.current, { opacity: ground.str * globalScale, duration: 1.2, ease: 'power2.out' })
    }

    // Accents (left + right edge blobs)
    if (accLRef.current && accRRef.current) {
      const bg = `radial-gradient(ellipse 50% 70% at 0% 60%, hsl(${accent.hue}, 85%, 55%) 0%, transparent 70%)`
      const bgR = `radial-gradient(ellipse 50% 70% at 100% 40%, hsl(${accent.hue + 10}, 80%, 50%) 0%, transparent 70%)`
      accLRef.current.style.background = bg
      accRRef.current.style.background = bgR
      gsap.to([accLRef.current, accRRef.current], { opacity: accent.str * globalScale, duration: 1.2, ease: 'power2.out' })
    }

    // Also update the CSS variable for the life gauge colour
    gsap.to(document.documentElement, {
      '--tint-hue': facade.hue,
      '--tint-intensity': globalScale * 0.75,
      duration: 1.2,
      ease: 'power2.out',
    })
  }, [choices, lifeScore])

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: 0,
    willChange: 'opacity',
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        // NO transform, filter, or isolation here — must share stacking context with canvas
      }}
    >
      {/* 1. Sky zone — soft-light blend */}
      <div
        ref={skyRef}
        style={{
          ...baseStyle,
          mixBlendMode: 'soft-light',
        }}
      />

      {/* 2. Facade zone — color blend, max 0.6 intensity */}
      <div
        ref={facadeRef}
        style={{
          ...baseStyle,
          mixBlendMode: 'color',
        }}
      />

      {/* 3. Ground zone — overlay blend */}
      <div
        ref={groundRef}
        style={{
          ...baseStyle,
          mixBlendMode: 'overlay',
        }}
      />

      {/* 4a. Left accent blob — soft-light */}
      <div
        ref={accLRef}
        style={{
          ...baseStyle,
          mixBlendMode: 'soft-light',
        }}
      />

      {/* 4b. Right accent blob — soft-light */}
      <div
        ref={accRRef}
        style={{
          ...baseStyle,
          mixBlendMode: 'soft-light',
        }}
      />
    </div>
  )
}
