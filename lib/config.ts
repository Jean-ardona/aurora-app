// Aurora — Frame configuration

export const FRAME_COUNT      = 504
export const FRAME_EXT        = 'webp'   // file extension used for all frames
export const ENABLE_CROSSBLEND = false
export const TOTAL_SCROLL_VH  = 600

/**
 * Progressive loading passes.
 * Pass 1 (stride 8)  → ~64 frames  — page becomes usable after this
 * Pass 2 (stride 4)  → ~64 more
 * Pass 3 (stride 2)  → ~126 more
 * Pass 4 (stride 1)  → remaining frames
 *
 * Data-saver mode stops after pass 2 (every 4th frame).
 */
export const LOAD_PASSES = [8, 4, 2, 1] as const

/**
 * Base URL for frames.
 * Dev: leave NEXT_PUBLIC_FRAMES_URL unset → /frames
 * Prod: set NEXT_PUBLIC_FRAMES_URL=https://your-cdn.com (no trailing slash)
 */
const FRAMES_BASE =
  process.env.NEXT_PUBLIC_FRAMES_URL?.replace(/\/$/, '') ?? '/frames'

export function getFramePath(index: number): string {
  const n = Math.max(1, Math.min(FRAME_COUNT, Math.round(index) + 1))
  return `${FRAMES_BASE}/ezgif-frame-${String(n).padStart(3, '0')}.${FRAME_EXT}`
}

/** Returns true when the device/connection warrants reduced loading */
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
