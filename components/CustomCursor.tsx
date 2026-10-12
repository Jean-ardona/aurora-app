'use client'

import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = dotRef.current
    if (!dot) return

    // Hide on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      dot.style.display = 'none'
      return
    }

    let mouseX = -100
    let mouseY = -100
    let raf: number

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const animate = () => {
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`
      raf = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(animate)

    // Grow on interactive elements
    const grow = () => dot.classList.add('cursor-grow')
    const shrink = () => dot.classList.remove('cursor-grow')

    const interactives = document.querySelectorAll('button, a, [role="button"]')
    interactives.forEach((el) => {
      el.addEventListener('mouseenter', grow)
      el.addEventListener('mouseleave', shrink)
    })

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <style>{`
        * { cursor: none !important; }
        .cursor-dot {
          position: fixed;
          top: 0;
          left: 0;
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          pointer-events: none;
          mix-blend-mode: difference;
          z-index: 9999;
          transition: width 0.2s ease, height 0.2s ease;
          will-change: transform;
        }
        .cursor-dot.cursor-grow {
          width: 20px;
          height: 20px;
        }
      `}</style>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  )
}
