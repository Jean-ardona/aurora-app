# Aurora: a city that does not exist yet

**Live demo:** https://aurora-app.deployxa.online
**Built for:** Hyperbloom October, UI/UX & Web Design hackathon

Aurora is a scroll-driven experience for a fictional new city. It starts as a grey, silent architectural model. The visitor decides what the city should become, and every choice brings light and color back to it.

## The problem

Fast-growing cities are usually designed without asking the people who will live in them. Housing, transport and green space are decided first; residents are consulted last, if at all.

## The idea

Aurora flips that order: **a city designed with its future residents from day one.** The city is shown as a black-and-white model. The visitor picks priorities (homes, nature, movement, culture), and the model gradually comes to life. Color is not decoration here, it is the progress bar of participation.

## The experience

1. **Loading screen:** a sun rises over a horizon line as the 3D model downloads, with real progress and rotating messages.
2. **Hero:** the city emerges from black, the camera sits at the start of a street.
3. **The problem:** three lines of copy appear as the camera moves forward.
4. **The model:** the city today, with live counters (residents, districts).
5. **Shape the city:** four priority cards. Each choice raises a "Life" gauge and softly tints the city.
6. **Roadmap:** from vision to first stone.
7. **Your Aurora:** a personal card with the visitor's choices, palette and a generated line, shareable.
8. **Join:** a founding-resident call to action.

## Design decisions

- **Monochrome as a concept.** A grey model means "not lived in yet". Color arrives only through participation, and stays a quiet tint so the architecture remains readable.
- **Typography.** Instrument Serif for large titles (editorial, architectural), Inter for labels and body.
- **Restraint.** Lots of empty space, hairline borders, glass cards, one idea per screen, copy written to be read in a few seconds.
- **Motion.** Transforms and opacity only, nothing bounces. Text reveals follow the camera.

## Technical highlights

- **Scroll-driven video.** The page position drives `video.currentTime`, smoothed with a time-based filter so motion is continuous on any refresh rate.
- **From frames to video.** The first version scrubbed 500 image frames. It looked right but loaded slowly and ran out of memory in the browser. Switching to a single video fixed memory and weight.
- **Keyframe tuning.** Analysing the MP4 showed a keyframe only every 3 seconds, which made backward scrolling hiccup. Re-encoding with a keyframe every 4 frames made seeking near-instant.
- **Reliable loading.** The video is fully downloaded before the experience starts, so scrubbing never waits for the network.
- **Color layer.** A fixed overlay of zoned gradients (sky, facades, ground, side accents) with blend modes, driven by CSS variables and animated with GSAP. Overall strength is tunable with `?strength=0.4`.
- **Adaptive quality.** The page measures its own frame rate at start and switches to a lighter mode on weak devices.

Detailed notes on the scroll engine: [docs/VIDEO_SCRUBBER_REPORT.md](docs/VIDEO_SCRUBBER_REPORT.md)

## Accessibility

Accessibility was considered in the design, and a full audit is planned.

<!-- VERIFY on the live site before publishing. -->
- Text over the video is supported by local contrast scrims and text shadows so it stays readable on bright frames.
- Short copy, large type and one idea per screen keep the reading load low.
- Known gaps, planned next: a full keyboard and screen-reader audit, and reduced-motion support.

## Tech stack

Next.js (App Router), TypeScript, Tailwind CSS, GSAP + ScrollTrigger, Lenis, Zustand.
<!-- VERIFY this list matches package.json -->

## Run locally

```bash
npm install
npm run dev          # development
npm run build && npm start   # production build
```

Add `?debug=1` to the URL to show a performance HUD.

## AI disclosure

Built with AI assistance, as allowed by the hackathon rules: Kiro was used as the development environment to write the code, and Claude helped with design direction, technical planning and writing. The concept, art direction choices, testing and decisions are the author's.

## Credits

- City model video: free stock footage from Pexels, used under the Pexels License.
- Fonts: Instrument Serif and Inter via Google Fonts (SIL Open Font License)

## Author

Ardona Jean-Baptiste
