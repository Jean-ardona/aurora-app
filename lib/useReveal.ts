import { useEffect, RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * useReveal — attaches a ScrollTrigger reveal animation to all elements
 * matching `selector` inside `containerRef`.
 *
 * Uses toggleActions so elements always end at opacity:1 / y:0.
 * Falls back to immediate reveal for reduced-motion users.
 */
export function useReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  options?: { stagger?: number; delay?: number }
) {
  const stagger = options?.stagger ?? 0.1
  const delay   = options?.delay   ?? 0

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const els = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (els.length === 0) return

    // Reduced motion — show immediately, no animation
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => {
        el.style.opacity = '1'
        el.style.transform = 'none'
      })
      return
    }

    // Set initial hidden state
    gsap.set(els, { y: 50, opacity: 0 })

    // Create one ScrollTrigger per element for independent triggering
    const triggers = els.map((el, i) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        // toggleActions: play / pause / resume / reverse
        // "play none none none" — fires once, stays at final state
        onEnter: () => {
          gsap.to(el, {
            y: 0,
            opacity: 1,
            duration: 0.9,
            delay: delay + i * stagger,
            ease: 'power3.out',
            overwrite: 'auto',
          })
        },
        // Safety net: if user scrolls back and the section is above viewport,
        // re-hide so it can re-animate. Comment out if you want one-shot only.
        onLeaveBack: () => {
          gsap.to(el, { y: 50, opacity: 0, duration: 0.4, ease: 'power2.in', overwrite: 'auto' })
        },
      })
    )

    // Failsafe: after 3s, force all to visible in case triggers never fired
    const failsafe = window.setTimeout(() => {
      els.forEach((el) => {
        const computed = window.getComputedStyle(el)
        if (parseFloat(computed.opacity) < 0.5) {
          gsap.set(el, { y: 0, opacity: 1 })
        }
      })
    }, 3000)

    return () => {
      triggers.forEach((t) => t.kill())
      clearTimeout(failsafe)
    }
  }, [containerRef, selector, stagger, delay])
}
