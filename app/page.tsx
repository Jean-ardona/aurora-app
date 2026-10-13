'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { TOTAL_SCROLL_VH, resolveMode, type ScrubMode } from '@/lib/config'

import HeroSection     from '@/components/sections/HeroSection'
import ProblemSection  from '@/components/sections/ProblemSection'
import ModelSection    from '@/components/sections/ModelSection'
import ChoiceSection   from '@/components/sections/ChoiceSection'
import RoadmapSection  from '@/components/sections/RoadmapSection'
import AuroraCardSection from '@/components/sections/AuroraCardSection'
import JoinSection     from '@/components/sections/JoinSection'

// Client-only — browser APIs
const VideoScrubber = dynamic(() => import('@/components/VideoScrubber'), { ssr: false })
const FrameCanvas   = dynamic(() => import('@/components/FrameCanvas'),   { ssr: false })
const ColorLayer    = dynamic(() => import('@/components/ColorLayer'),    { ssr: false })
const FixedUI       = dynamic(() => import('@/components/FixedUI'),       { ssr: false })
const CustomCursor  = dynamic(() => import('@/components/CustomCursor'),  { ssr: false })
const LenisInit     = dynamic(() => import('@/components/LenisInit'),     { ssr: false })

export default function HomePage() {
  // Resolve mode on client (reads ?mode= URL param)
  const [mode, setMode] = useState<ScrubMode>('video') // default matches config
  useEffect(() => { setMode(resolveMode()) }, [])

  const handleReady    = useCallback(() => {}, [])
  const scrollToNext   = useCallback(() => {
    document.getElementById('roadmap')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <>
      {/*
        ─── SCRUBBER LAYER (z-index 0) ────────────────────────────────────────
        Exactly one is rendered at a time.
        Both sit at position:fixed, z-index:0 — same stacking context as
        ColorLayer so mix-blend-mode blends with the background correctly.
      */}
      {mode === 'video'
        ? <VideoScrubber onReady={handleReady} />
        : <FrameCanvas   onReady={handleReady} />
      }

      {/* Color overlay (z-index 1) */}
      <ColorLayer />

      {/* Fixed chrome (z-index 50) */}
      <FixedUI />
      <CustomCursor />

      {/* Lenis smooth scroll — renders null, no DOM wrapper */}
      <LenisInit />

      {/*
        ─── GLOBAL VIGNETTE (z-index 2) ───────────────────────────────────────
        Soft radial darkening at the edges. No hard lines, no full-width blocks.
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
        No zIndex — avoids isolating content from the blend layers below.
        No transform / overflow / filter / will-change.
      */}
      <main
        id="scroll-container"
        style={{ position: 'relative', minHeight: `${TOTAL_SCROLL_VH}vh` }}
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
