// Aurora — Frame configuration
// FRAME_COUNT is set to match the actual files in /public/frames/
// (counted: 504 JPGs, ezgif-frame-001.jpg … ezgif-frame-504.jpg)
export const FRAME_COUNT = 504

// Set to false to disable cross-blending of adjacent frames.
// Cross-blend looked smooth on slow cameras but caused double-image ghosting
// during fast camera movement. With ENABLE_CROSSBLEND = false the engine
// always draws a single integer frame — sharp at every scroll speed.
export const ENABLE_CROSSBLEND = false

export function getFramePath(index: number): string {
  // index is 0-based, files are 1-based, zero-padded to 3 digits
  const n = Math.max(1, Math.min(FRAME_COUNT, Math.round(index) + 1))
  return `/frames/ezgif-frame-${String(n).padStart(3, '0')}.jpg`
}

// Total scroll height in vh for the pinned animation.
// 504 frames at ~35vh/s of video ≈ 600vh still feels right.
export const TOTAL_SCROLL_VH = 600

// Number of frames to load before revealing the page
export const FIRST_BATCH = 24
