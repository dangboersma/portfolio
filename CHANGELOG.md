# Changelog

## v1.0.0 — Initial build

### What was built
- Full fine-art photography portfolio site, deployed to GitHub Pages at https://dangboersma.github.io/portfolio/

### Image pipeline
- 53 source photos processed from `source-photos/` via `sharp`
- Generated WebP at 400/800/1600/2400px per photo
- 20px placeholder base64 encoded into `photos.json` for blur-up loading
- Total processed: 53 photos × up to 4 sizes = ~200 WebP files

### Exhibition mode
- Fullscreen WebGL canvas (OGL) with custom watercolor-raindrop fragment shader
- Auto-advances every 6 seconds; arrow keys / click zones / swipe for manual control
- `contain` display (full image visible, black letterbox) computed in fragment shader

### The watercolor-raindrop transition (full quality, desktop)
- Drop 1 hits at t≈0.1; radial ripple displacement spreads and decays
- Kuwahara filter (radius 2, 36 samples/pixel/texture) flattens image into painted color regions
- Sobel edge darkening for pigment pooling effect
- Multi-scale paper grain overlay (3 octaves of value noise)
- Curl-noise domain warping for watercolor swirl; peaks at t=0.5
- Drop 2 impacts at t≈0.6; radial mask expands, revealing B from watercolor to sharp
- Total duration: 3.2 seconds

**Tunable shader knobs** (in `src/shader.js`, `fragmentFull`):
- **Warp amount**: `warp = swirlEnv * 0.027` — increase for more swirl
- **Kuwahara radius**: `kR = swirlEnv * 0.0055` — increase for more painterly, costs GPU
- **Edge darkening**: `edgeA/B * 0.55` multiplier — increase for deeper pigment pooling
- **Paper grain opacity**: `g * 0.055 - 0.027` — adjust range for more/less texture
- **Ripple strength**: `* 0.013` near the ripple displacement lines — increase for bigger drops
- **Transition duration**: `TRANSITION_MS = 3200` in `src/exhibition.js`
- **Auto-advance interval**: `AUTO_ADVANCE_MS = 6000` in `src/exhibition.js`

### Fallbacks
- Mobile / narrow viewport: simple smoothstep crossfade (700ms)
- `prefers-reduced-motion`: same crossfade
- No WebGL2: CSS background-image auto-slideshow

### Index view
- Dark grid, auto-fill columns, lazy-loaded 800px WebP images
- Blur-up placeholders from base64 data
- Click any photo to enter exhibition at that index; `Escape` returns to exhibition

### Deploy
- GitHub Pages via `actions/upload-pages-artifact` / `actions/deploy-pages`
- CI runs `npm ci && npm run build`; no image processing in CI (processed images committed)

### Lighthouse targets
- Performance, Accessibility, Best Practices measured after first deploy — update here
