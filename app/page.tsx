'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TOTAL_SCROLL_VH } from '@/lib/config'

import HeroSection from '@/components/sections/HeroSection'
import ProblemSection from '@/components/sections/ProblemSection'
import ModelSection from '@/components/sections/ModelSection'
import ChoiceSection from '@/components/sections/ChoiceSection'
import RoadmapSection from '@/components/sections/RoadmapSection'
import AuroraCardSection from '@/components/sections/AuroraCardSection'
import JoinSection from '@/components/sections/JoinSection'

// Client-only components (use browser APIs)
const FrameCanvas = dynamic(() => import('@/components/FrameCanvas'), { ssr: false })
const ColorLayer  = dynamic(() => import('@/components/ColorLayer'),  { ssr: false })
const FixedUI     = dynamic(() => import('@/components/FixedUI'),     { ssr: false })
const CustomCursor = dynamic(() => import('@/components/CustomCursor'), { ssr: false })
const LenisInit   = dynamic(() => import('@/components/LenisInit'),   { ssr: false })

export default function HomePage() {
  const handleCanvasReady = useCallback(() => {}, [])

  const scrollToNext = useCallback(() => {
    const el = document.getElementById('roadmap')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <>
      {/*
        ─── FIXED LAYER (position:fixed, never inside a transformed parent) ───
        These elements must live at the top of the React tree, directly inside
        <body>. They must NOT be inside any wrapper with transform/overflow/
        will-change. Lenis operates on document.documentElement so it never
        wraps DOM elements — safe.
      */}
      <FrameCanvas onReady={handleCanvasReady} />
      <ColorLayer />
      <FixedUI />
      <CustomCursor />

      {/*
        ─── LENIS INIT ─────────────────────────────────────────────────────────
        Bootstraps Lenis smooth scroll on document.documentElement.
        No wrapper element — just a useEffect hook rendered as null.
      */}
      <LenisInit />

      {/*
        ─── GLOBAL VIGNETTE ────────────────────────────────────────────────────
        Fixed radial vignette above the color layer (z:2) and below all content
        (z:10). Darkens the edges of the frame subtly — no hard edges, no full-
        width dark blocks. Helps text contrast on bright sky/facade frames.
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/*
        ─── SCROLLABLE CONTENT ─────────────────────────────────────────────────
        position:relative so sections can use position:absolute for their scrims.
        NO zIndex here — we don't want to create a stacking context that would
        isolate the content from the canvas/color-layer blend below.
        NO transform, overflow, filter, or will-change.
      */}
      <main
        id="scroll-container"
        style={{
          position: 'relative',
          minHeight: `${TOTAL_SCROLL_VH}vh`,
        }}
      >
        <HeroSection />
        <ProblemSection />
        <ModelSection />
        <ChoiceSection onContinue={scrollToNext} />
        <RoadmapSection />
        <AuroraCardSection />
        <JoinSection />
      </main>
    </>
  )
}
