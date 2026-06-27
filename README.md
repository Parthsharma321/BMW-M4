# BMW M4 Competition — 3D Showcase Website

A cinematic, scroll-driven 3D product page built around a real BMW M4 GLB model — Three.js for the 3D scene, GSAP + ScrollTrigger for animation, Lenis for smooth scroll.

## Running it

This uses ES modules, so it needs to be served over HTTP — opening `index.html` directly (`file://`) will not work.

```bash
npx serve
# or
python3 -m http.server 8000
```

Then open the printed URL. In VS Code, the **Live Server** extension also works (right-click `index.html` → "Open with Live Server").

## File structure

```
bmw-m4-site/
├── index.html        All page markup — nav, hero, and every content section
├── style.css         Design system: colors, typography, layout, glassmorphism, animations
├── main.js           Orchestrator — scroll setup, UI wiring, render loop
├── scene.js           Three.js renderer, lighting rig, environment, post-processing
├── carLoader.js       Loads the GLB, fixes scale/centering, tunes materials per part
├── cameraPath.js       Camera keyframes for every section + the spline that connects them
├── audio.js            Procedural engine-hum / click sounds (Web Audio, no sound files)
└── assets/
    └── bmw-m4.glb      The 3D model
```

## How the camera system works

- The car stays still. Every section has a fixed camera position/look-target/fov in `cameraPath.js`, placed at a steadily increasing angle around the car (20° → 430°, just over one lap).
- Scrolling drives a single progress value (0–1) across the whole page. `sampleCameraPath()` turns that into a smooth Catmull-Rom spline through all the keyframes, so the camera glides around the car instead of jumping between shots.
- Because each keyframe sits only ~40° further around than the last, the curve always sweeps around the *outside* of the car — it never cuts through the middle of the body.
- A `cameraScaleCorrection` factor (computed once the model loads) rescales every camera distance to match the model's real size, so the framing isn't dependent on guessing the car's exact dimensions.
- The only time the car itself rotates is a slow idle spin at the very top of the page, before you start scrolling.

## Sections

Hero → Overview → Performance (animated stat counters) → Exterior → Interior → Technology/Engine → Wheels → Specs table → Gallery (camera presets) → Showcase → Contact → Footer.

## Interactive features

- **Rotate toggle / Reset / Fullscreen** — buttons in the hero corner
- **Gallery presets** — Front / Side / Rear / Top / Cockpit buttons jump the camera to a fixed angle
- **Mute button** — toggles the procedural engine hum and UI click sounds
- **Mobile menu** — hamburger nav below ~880px width
- **Section rail** — the glowing vertical line on the right edge tracks scroll progress

## Material handling

`carLoader.js` doesn't hand-pick every mesh — it reads each part's name (e.g. `Body`, `Rim`, `Glass`, `Brake`, `Headlight`) and applies appropriate PBR values automatically: black lacquer paint with light clearcoat, satin-metal rims, transparent glass, glowing headlights on scroll, matte tires, brushed brake discs.

## Known limitation

This was built and logic-tested in a sandboxed environment without access to the real Three.js/GSAP CDN or a real browser's WebGL renderer — the JS logic and DOM behavior were verified against local stand-ins, but the actual visual rendering (lighting, scale, framing) could only be tuned from screenshots you sent back. If something still looks off, a screenshot is the fastest way to get it fixed precisely.
