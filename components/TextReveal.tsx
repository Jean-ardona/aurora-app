'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface TextRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
  trigger?: string
}

export default function TextReveal({ children, delay = 0, className = '', trigger }: TextRevealProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const line = el.querySelector('.reveal-line') as HTMLElement
    if (!line) return

    // Check reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(line, { y: 0, opacity: 1 })
      return
    }

    gsap.set(line, { y: 60, opacity: 0 })

    const st = ScrollTrigger.create({
      trigger: trigger ? document.querySelector(trigger) || el : el,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(line, {
          y: 0,
          opacity: 1,
          duration: 0.9,
          delay,
          ease: 'power3.out',
        })
      },
      once: true,
    })

    return () => st.kill()
  }, [delay, trigger])

  return (
    <div ref={wrapRef} className={`reveal-wrap ${className}`}>
      <span className="reveal-line">{children}</span>
    </div>
  )
}
