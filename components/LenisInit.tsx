'use client'

/**
 * LenisInit — bootstraps Lenis on document.documentElement.
 * Renders null. Never wraps DOM nodes (cannot break position:fixed).
 *
 * Sync strategy:
 *  lenis.on('scroll', ScrollTrigger.update)   — keeps ST in sync on every tick
 *  gsap.ticker.add(t => lenis.raf(t * 1000))  — drives Lenis from GSAP's RAF
 *  gsap.ticker.lagSmoothing(0)                — prevents GSAP from skipping frames
 *
 * Options:
 *  lerp: 0.1   — smooth but responsive (Lenis docs recommend 0.1)
 *  smoothWheel: true
 * We use scrub:true in ScrollTrigger (not scrub:0.5) so there is no double
 * smoothing — Lenis handles the ease, ST maps 1:1.
 */

import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function LenisInit() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
    })

    // Sync ScrollTrigger scroll position with Lenis on every scroll event
    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [])

  return null
}
