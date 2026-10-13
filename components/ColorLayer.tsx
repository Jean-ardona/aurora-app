'use client'

/**
 * ColorLayer v2 — subtler city tints.
 *
 * Zone caps (before multiplying by COLOR_STRENGTH):
 *   sky    → max 0.50  (soft-light)
 *   facade → max 0.50  (color blend)
 *   ground → max 0.40  (overlay)
 *   accents → max 0.30 (soft-light, side blobs)
 *
 * COLOR_STRENGTH default 0.4 → final opacities with all 4 priorities:
 *   sky    ≈ 0.50 × 0.40 = 0.20
 *   facade ≈ 0.50 × 0.40 = 0.20
 *   ground ≈ 0.40 × 0.40 = 0.16
 *   accents ≈ 0.30 × 0.40 = 0.12
 *
 * Desaturated city-tint colors (vivid colors kept only for UI chips/borders):
 *   Housing  #c9a27a  hsl(30, 38%, 63%)
 *   Nature   #7fa89a  hsl(168, 17%, 57%)
 *   Mobility #7a97c4  hsl(213, 37%, 62%)
 *   Culture  #a98bb5  hsl(286, 24%, 62%)
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useAuroraStore, type Priority } from '@/lib/store'
import { resolveColorStrength } from '@/lib/config'

// ─── Desaturated hue values ───────────────────────────────────────────────────
const CITY_HUE: Record<Priority, number> = {
  housing:  30,   // warm sand
  nature:   168,  // muted teal
  mobility: 213,  // soft blue
  culture:  286,  // muted mauve
}

// ─── Per-priority zone strength weights ───────────────────────────────────────
const ZONE_WEIGHTS: Record<Priority, {
  sky: number; facade: number; ground: number; accent: number
}> = {
  housing:  { sky: 0.9,  facade: 0.2, ground: 0.8,  accent: 0.1  },
  nature:   { sky: 0.25, facade: 0.9, ground: 0.25, accent: 0.2  },
  mobility: { sky: 0.25, facade: 0.8, ground: 0.5,  accent: 0.15 },
  culture:  { sky: 0.35, facade: 0.35, ground: 0.25, accent: 0.95 },
}

// ─── Per-zone hard caps ────────────────────────────────────────────────────────
const ZONE_CAPS = { sky: 0.50, facade: 0.50, ground: 0.40, accent: 0.30 } as const
type ZoneName = keyof typeof ZONE_CAPS

function blendZone(choices: Priority[], zone: ZoneName) {
  if (choices.length === 0) return { hue: 30, str: 0 }
  let hueSum = 0, strSum = 0
  choices.forEach((p) => {
    hueSum += CITY_HUE[p]
    strSum += ZONE_WEIGHTS[p][zone]
  })
  return {
    hue: hueSum / choices.length,
    str: Math.min(strSum / choices.length, ZONE_CAPS[zone]),
  }
}

export default function ColorLayer() {
  const { choices, lifeScore } = useAuroraStore()

  const skyRef    = useRef<HTMLDivElement>(null)
  const facadeRef = useRef<HTMLDivElement>(null)
  const groundRef = useRef<HTMLDivElement>(null)
  const accLRef   = useRef<HTMLDivElement>(null)
  const accRRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const strength    = resolveColorStrength()
    const globalScale = (lifeScore / 100) * strength

    if (lifeScore === 0) {
      ;[skyRef, facadeRef, groundRef, accLRef, accRRef].forEach((r) => {
        if (r.current) gsap.to(r.current, { opacity: 0, duration: 1.2, ease: 'power2.out' })
      })
      return
    }

    const sky    = blendZone(choices, 'sky')
    const facade = blendZone(choices, 'facade')
    const ground = blendZone(choices, 'ground')
    const accent = blendZone(choices, 'accent')

    // Final opacities = zone.str × globalScale
    // With strength=0.4 and all 4 priorities selected:
    //   sky    = 0.50 × (1.0 × 0.4) = 0.20
    //   facade = 0.50 × (1.0 × 0.4) = 0.20
    //   ground = 0.40 × (1.0 × 0.4) = 0.16
    //   accents= 0.30 × (1.0 × 0.4) = 0.12
    const skyOp    = sky.str    * globalScale
    const facadeOp = facade.str * globalScale
    const groundOp = ground.str * globalScale
    const accentOp = accent.str * globalScale

    if (skyRef.current) {
      // Use desaturated city hue (low saturation for soft light effect)
      skyRef.current.style.background =
        `radial-gradient(ellipse 100% 55% at 50% 0%, hsl(${sky.hue}, 45%, 62%) 0%, hsl(${sky.hue + 12}, 35%, 52%) 45%, transparent 75%)`
      gsap.to(skyRef.current, { opacity: skyOp, duration: 1.2, ease: 'power2.out' })
    }

    if (facadeRef.current) {
      facadeRef.current.style.background =
        `linear-gradient(170deg, hsl(${facade.hue + 15}, 30%, 45%) 0%, hsl(${facade.hue - 10}, 25%, 38%) 100%)`
      gsap.to(facadeRef.current, { opacity: facadeOp, duration: 1.2, ease: 'power2.out' })
    }

    if (groundRef.current) {
      groundRef.current.style.background =
        `radial-gradient(ellipse 80% 60% at 50% 120%, hsl(${ground.hue}, 50%, 60%) 0%, hsl(${ground.hue + 8}, 40%, 50%) 40%, transparent 70%)`
      gsap.to(groundRef.current, { opacity: groundOp, duration: 1.2, ease: 'power2.out' })
    }

    if (accLRef.current && accRRef.current) {
      accLRef.current.style.background =
        `radial-gradient(ellipse 50% 70% at 0% 60%, hsl(${accent.hue}, 40%, 50%) 0%, transparent 70%)`
      accRRef.current.style.background =
        `radial-gradient(ellipse 50% 70% at 100% 40%, hsl(${accent.hue + 8}, 35%, 48%) 0%, transparent 70%)`
      gsap.to([accLRef.current, accRRef.current], { opacity: accentOp, duration: 1.2, ease: 'power2.out' })
    }

    // CSS var for UI elements (life gauge, etc.) — keep hue-only, vivid stays for UI
    gsap.to(document.documentElement, {
      '--tint-hue': facade.hue,
      '--tint-intensity': (lifeScore / 100) * 0.75,
      duration: 1.2, ease: 'power2.out',
    })
  }, [choices, lifeScore])

  const base: React.CSSProperties = {
    position: 'absolute', inset: 0,
    pointerEvents: 'none', opacity: 0, willChange: 'opacity',
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
      }}
    >
      <div ref={skyRef}    style={{ ...base, mixBlendMode: 'soft-light' }} />
      <div ref={facadeRef} style={{ ...base, mixBlendMode: 'color'      }} />
      <div ref={groundRef} style={{ ...base, mixBlendMode: 'overlay'    }} />
      <div ref={accLRef}   style={{ ...base, mixBlendMode: 'soft-light' }} />
      <div ref={accRRef}   style={{ ...base, mixBlendMode: 'soft-light' }} />
    </div>
  )
}
