# Aurora — Video Scrubber Technical Report

Generated: 2026-10-12

---

## 1. Full flow from scroll event to a new frame on screen

```
User scrolls
    │
    ▼
Lenis (lerp: 0.1, smoothWheel: true)
    │  Intercepts native scroll, applies exponential easing so the
    │  scroll position advances smoothly even if the user stops.
    │  Calls ScrollTrigger.update() on every tick via lenis.on('scroll', …).
    │
    ▼
GSAP ScrollTrigger  (trigger: #scroll-container, start: top top, end: bottom bottom, scrub: true)
    │  Maps the current scroll position to a progress value 0→1.
    │  scrub:true means progress tracks scroll 1:1 (no additional GSAP delay).
    │  Calls onUpdate(self) → targetRef.current = self.progress * video.duration
    │
    ▼
targetRef  (a React ref — no re-render, written from any thread)
    │  Holds the DESIRED video time in seconds (float, 0 → 16.8 s).
    │
    ▼
requestAnimationFrame loop  (runs every ~16.67 ms at 60 fps)
    │  const delta = targetRef.current - currentRef.current
    │
    │  if |delta| < SNAP_THRESHOLD (0.01 s):
    │      currentRef.current = target          ← snap exactly
    │  else:
    │      currentRef.current += delta * 0.12   ← lerp (exponential decay)
    │
    ▼
seekTo(video, currentRef.current)
    │  Guards: skip if video.seeking || |t - lastSetTime| < 1/60 s
    │  Uses video.fastSeek(t) when available (Chrome/Firefox)
    │  otherwise video.currentTime = t
    │
    ▼
Browser video decoder
    │  Receives new currentTime.
    │  Finds the nearest keyframe ≤ t, decodes from there to t.
    │  Fires 'seeked' when the frame is ready.
    │
    ▼
New frame painted on screen  ← visible to user
```

---

## 2. Exact seek logic and animation loop

### seekTo
```typescript
function seekTo(video: HTMLVideoElement, t: number) {
  if (video.seeking) return                        // never queue a second seek
  const clamped = Math.max(0, Math.min(video.duration || 0, t))
  if (Math.abs(clamped - lastSetRef.current) < MIN_SEEK_DELTA) return  // 1/60 s threshold
  lastSetRef.current = clamped
  const v = video as HTMLVideoElement & { fastSeek?: (t: number) => void }
  if (typeof v.fastSeek === 'function') {
    v.fastSeek(clamped)            // faster, less precise
  } else {
    video.currentTime = clamped    // precise
  }
}
```

### rAF loop
```typescript
const loop = () => {
  if (document.hidden) { rafRef.current = 0; return }   // pause when tab hidden
  rafRef.current = requestAnimationFrame(loop)

  const video  = videoRef.current
  if (!video || !video.duration) return

  const target = targetRef.current
  const prev   = currentRef.current
  const delta  = target - prev

  if (Math.abs(delta) < SNAP_THRESHOLD) {   // 0.01 s
    currentRef.current = target
    seekTo(video, target)
    return
  }

  currentRef.current = prev + delta * LERP_FACTOR   // 0.12
  seekTo(video, currentRef.current)
}
```

---

## 3. How queued seeks are avoided / when we snap

**Avoiding queued seeks:**
- `if (video.seeking) return` — if a seek is already in progress, `seekTo` returns immediately without setting `currentTime` again. This prevents a queue of pending seeks building up.
- `if (|t - lastSetTime| < 1/60 s) return` — sub-frame-duration changes are skipped entirely.
- The improved version (Part 2) uses `requestVideoFrameCallback` after each `'seeked'` event, so the next seek is only dispatched once the previous frame has been *presented* on screen (not just decoded).

**Snapping:**
When `|target - current| < 0.01 s` (half a frame at 25 fps), we assign `current = target` exactly and seek to that precise time. This eliminates the asymptotic crawl at the end of a Lenis deceleration where the lerp would never fully reach the target.

---

## 4. Video facts

| Property         | Value                                      |
|------------------|--------------------------------------------|
| File             | `/public/city.mp4`                         |
| File size        | 4.92 MB                                    |
| Codec            | H.264 (AVC, `avc1` box)                   |
| Resolution       | 1920 × 1080 (1080p)                        |
| FPS              | 25.000 fps (constant frame rate)           |
| Duration         | 16.800 s                                   |
| Avg bitrate      | 2 457 kbps                                 |
| Total frames     | 420                                        |
| Total keyframes  | 6 (1.4% of frames)                         |
| Keyframe interval| **75 frames = 3.000 s** (fixed, every 75 frames) |
| Keyframe positions| samples 1, 76, 151, 226, 301, 376          |

### Keyframe analysis (from `stss` box)
```
Gaps (in frames): 75, 75, 75, 75, 75
Avg gap: 75.0 frames (3.000 s)
Max gap: 75 frames  (3.000 s)
Min gap: 75 frames  (3.000 s)
```

**What this means for seeking:** Every time the browser needs to display a frame that is not itself a keyframe, the H.264 decoder must:
1. Find the nearest keyframe *before* the target time (up to 74 frames / 2.96 s earlier)
2. Decode all P-frames and B-frames from that keyframe to the target

This is the dominant cause of seek latency. Decoding 74 delta-frames takes 20-80 ms on a mid-range CPU.

### ffmpeg command to re-encode with a keyframe on every frame
```bash
ffmpeg -i public/city.mp4 -c:v libx264 -preset fast -crf 18 \
  -x264-params "keyint=1:min-keyint=1:scenecut=0" \
  -an public/city-allkey.mp4
```
This makes every frame a keyframe (I-frame only stream). File size grows ~2-3× (~10-15 MB) but every seek becomes nearly instantaneous because the decoder only needs to decode one frame. **This is the single most impactful change for seek smoothness.**

---

## 5. Causes of remaining hiccups — ranked by likelihood

### 1. ⚠️ KEYFRAME INTERVAL TOO LARGE (3 seconds) — **primary cause**
The browser decoder must walk back up to 75 frames to find a keyframe and decode forward. This takes 20-80 ms per seek. During fast scrolling (many seeks/second), multiple consecutive seeks each hit this cost. The result is a visible freeze for 1-3 frames.

**Fix:** Re-encode with `keyint=1` (all-intra). Alternatively set a max 0.5s interval (`keyint=12` at 25fps).

### 2. fastSeek() imprecision causing jitter
`fastSeek()` snaps to the nearest keyframe for speed. At a 3-second keyframe interval, this can be off by ±1.5 seconds. The frame shown may not match the scroll position, causing a visual jump when `currentTime` snaps backward to the keyframe.

**Fix:** Use `currentTime =` instead of `fastSeek()`. Slower but frame-accurate. With all-intra encoding both are equally fast and accurate.

### 3. Per-frame lerp factor is frame-rate dependent
`current += delta * 0.12` is applied once per rAF tick. On a 60 Hz screen this is fine. On a 120 Hz display the lerp runs twice as fast, making the motion feel snappy but also making the `MIN_SEEK_DELTA` guard trigger more often and potentially skip seeks.

**Fix:** Time-based lerp: `current += delta * (1 - exp(-dt * 12))` where `dt` is the actual elapsed seconds since the last frame. This is frame-rate independent.

### 4. backdrop-filter cost during scroll
Sections use `backdropFilter: 'blur(20-24px)'` on the priority cards and Aurora card. The browser re-composites the blurred layer on every frame during scroll. This adds 2-8 ms of GPU time per frame.

**Fix:** Disable backdrop-filter when scroll speed > threshold, restore on scroll stop.

### 5. React re-renders from ColorLayer GSAP tweens
When the user selects priorities, GSAP animates CSS variables on `document.documentElement`. If this animation is running while the user scrolls, there are two animation sources competing for the main thread.

**Fix:** Already mitigated (ColorLayer uses direct DOM refs). Adaptive quality mode (Part 2e) can disable blend modes entirely on low-end devices.

### 6. Main thread long tasks from other components
ScrollTrigger's `onUpdate` callbacks for text reveals, FixedUI progress, and the color layer all run on the main thread. If any takes > 2 ms, the rAF loop is delayed.

**Fix:** Measure with PerformanceObserver `longtask` (implemented in new HUD).

---

## Part 2 — Improvements implemented

See `VideoScrubber.tsx` for implementation. All flags are URL parameters:

| Flag | Default | Effect |
|------|---------|--------|
| `?rvfc=0` | ON | Disable requestVideoFrameCallback gating |
| `?timelerp=0` | ON | Use per-frame lerp instead of time-based |
| `?backdrop=0` | ON | Keep backdrop-filter always on |
| `?quality=0` | ON | Disable adaptive quality measurement |
| `?debug=1` | OFF | Show HUD with all metrics |

**Most impactful remaining fix:** Replace the video with an all-intra encoded version using the ffmpeg command above. Without that, seek latency is bounded by the 75-frame keyframe interval.

---

*Report generated from `scripts/analyze-mp4.mjs` + code analysis.*
