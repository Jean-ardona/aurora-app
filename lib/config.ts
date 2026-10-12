// Aurora — Frame configuration

export const FRAME_COUNT = 504
export const ENABLE_CROSSBLEND = false
export const TOTAL_SCROLL_VH = 600
export const FIRST_BATCH = 24

/**
 * Base URL for frames.
 * - In development (frames in /public/frames/): leave NEXT_PUBLIC_FRAMES_URL unset → uses /frames/
 * - In production (frames on CDN): set NEXT_PUBLIC_FRAMES_URL=https://pub-xxx.r2.dev
 *
 * Set this in Vercel: Project Settings → Environment Variables
 *   Key:   NEXT_PUBLIC_FRAMES_URL
 *   Value: https://pub-XXXXXXXXXXXXXXXX.r2.dev
 */
const FRAMES_BASE =
  process.env.NEXT_PUBLIC_FRAMES_URL?.replace(/\/$/, '') ?? '/frames'

export function getFramePath(index: number): string {
  const n = Math.max(1, Math.min(FRAME_COUNT, Math.round(index) + 1))
  return `${FRAMES_BASE}/ezgif-frame-${String(n).padStart(3, '0')}.jpg`
}
