'use client'

/**
 * ColorLayer — UI-only color system.
 *
 * The overlay divs on top of the city video have been removed entirely.
 * mix-blend-mode layers were causing GPU repaints on every scroll frame,
 * making the video stutter when priorities were selected.
 *
 * What remains:
 *   - Updates CSS variables --tint-hue and --tint-intensity on :root
 *   - These drive the UI elements only: life gauge line, card borders,
 *     priority chips, palette swatches
 *   - The city stays black and white — no color overlay on the video
 */

import { useEffect } from 'react'
import { gsap } from 'gsap'
import { useAuroraStore, type Priority } from '@/lib/store'

const CITY_HUE: Record<Priority, number> = {
  housing:  30,
  nature:   168,
  mobility: 213,
  culture:  286,
}

function avgHue(choices: Priority[]): number {
  if (!choices.length) return 30
  return choices.reduce((sum, p) => sum + CITY_HUE[p], 0) / choices.length
}

export default function ColorLayer() {
  const { choices, lifeScore } = useAuroraStore()

  useEffect(() => {
    const hue   = avgHue(choices)
    const intensity = (lifeScore / 100) * 0.75

    // Animate CSS variables — drives gauge line color and UI accent only
    gsap.to(document.documentElement, {
      '--tint-hue':       hue,
      '--tint-intensity': intensity,
      duration: 1.2,
      ease: 'power2.out',
    })
  }, [choices, lifeScore])

  // No DOM elements — this component is pure side-effects
  return null
}
