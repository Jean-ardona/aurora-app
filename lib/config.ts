// Aurora — Frame configuration

export const FRAME_COUNT      = 504
export const FRAME_EXT        = 'webp'
export const ENABLE_CROSSBLEND = false
export const TOTAL_SCROLL_VH  = 600

/**
 * COLOR_STRENGTH multiplies the opacity of every ColorLayer zone.
 * Default 0.4 → city reads as mostly grey with soft colored light.
 * Override: ?strength=0.2  to  ?strength=1.2
 */
export const COLOR_STRENGTH_DEFAULT = 0.4

export function resolveColorStrength(): number {
  if (typeof window === 'undefined') return COLOR_STRENGTH_DEFAULT
  const v = parseFloat(new URLSearchParams(window.location.search).get('strength') ?? '')
  if (!isNaN(v)) return Math.max(0, Math.min(1.5, v))
  return COLOR_STRENGTH_DEFAULT
}

/**
 * Scrubber mode.
 * Default: 'video' (uses /public/city.mp4, ~5 MB, instant seek)
 * Fallback: 'frames' (uses /public/frames/ WebP sequence)
 *
 * Override at runtime:
 *   ?mode=video   → force video mode
 *   ?mode=frames  → force frame-sequence mode
 */
export type ScrubMode = 'video' | 'frames'
export const DEFAULT_MODE: ScrubMode = 'video'

/** Resolve the active mode from URL params (client-only) */
export function resolveMode(): ScrubMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  const p = new URLSearchParams(window.location.search).get('mode')
  if (p === 'frames') return 'frames'
  if (p === 'video')  return 'video'
  return DEFAULT_MODE
}

export const VIDEO_SRC_FAST = '/city-fast.mp4'  // keyframe every 4 frames — default
export const VIDEO_SRC_ORIG = '/city.mp4'        // original, keyframe every 75 frames

/**
 * Resolve which video source to use.
 * Default: city-fast.mp4 (short keyframe interval → frame-accurate scrubbing)
 * Override: ?src=orig → city.mp4 (for comparison)
 */
export function resolveVideoSrc(): string {
  if (typeof window === 'undefined') return VIDEO_SRC_FAST
  return new URLSearchParams(window.location.search).get('src') === 'orig'
    ? VIDEO_SRC_ORIG
    : VIDEO_SRC_FAST
}

// Keep VIDEO_SRC as a re-export for any code that imports it directly
export const VIDEO_SRC = VIDEO_SRC_FAST

export const LOAD_PASSES = [8, 4, 2, 1] as const

const FRAMES_BASE =
  process.env.NEXT_PUBLIC_FRAMES_URL?.replace(/\/$/, '') ?? '/frames'

export function getFramePath(index: number): string {
  const n = Math.max(1, Math.min(FRAME_COUNT, Math.round(index) + 1))
  return `${FRAMES_BASE}/ezgif-frame-${String(n).padStart(3, '0')}.${FRAME_EXT}`
}

export function isDataSaver(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (conn?.saveData) return true
  if (conn?.effectiveType === '2g' || conn?.effectiveType === '3g') return true
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem !== undefined && mem <= 2) return true
  return false
}
