# Portfolio

Fine-art photography portfolio — dark gallery-wall presentation with a custom WebGL watercolor-raindrop transition.

**Live site:** https://dangboersma.github.io/portfolio/

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/portfolio/

## Adding or removing photos

1. Drop new JPG files into `source-photos/`
2. To exclude a file, add its filename to the `EXCLUDE` set in `scripts/process-images.mjs`
3. Run the image pipeline:
   ```bash
   npm run process
   ```
4. Commit the updated `src/photos.json` and new files under `public/images/`

Photos are numbered sequentially (01, 02, …) in the order the script sorts them: date-prefixed filenames (YYYYMMDD…) come first chronologically, then remaining files alphabetically.

## Changing photo order

Edit the `sortKey` function in `scripts/process-images.mjs`, or rename your files with a date prefix (`YYYYMMDD-yourfile.jpg`).

## Tuning the transition

All knobs are in `src/shader.js` (`fragmentFull`) and `src/exhibition.js`. See [CHANGELOG.md](./CHANGELOG.md) for a full list of tunable parameters.

Quick reference:
| What | Where | Default |
|---|---|---|
| Transition duration | `exhibition.js` `TRANSITION_MS` | 3200ms |
| Auto-advance interval | `exhibition.js` `AUTO_ADVANCE_MS` | 6000ms |
| Swirl / warp amount | `shader.js` `warp = swirlEnv * 0.027` | 0.027 |
| Painterly radius | `shader.js` `kR = swirlEnv * 0.0055` | 0.0055 |
| Edge darkening | `shader.js` `* 0.55` (edgeA/edgeB lines) | 0.55 |
| Paper grain | `shader.js` `g * 0.055 - 0.027` | 0.055/0.027 |
| Ripple strength | `shader.js` `* 0.013` (ripple1/2 lines) | 0.013 |

## Deploying

Push to `main` — GitHub Actions builds and deploys automatically.

First-time setup: enable GitHub Pages in **Settings → Pages → Source: GitHub Actions**.

## Manual QA checklist

- [x] Production build completes with no errors (`npm run build`)
- [x] No broken asset references in `dist/`
- [x] Exhibition mode loads and auto-advances
- [x] Arrow keys navigate forward/back
- [x] Click left/right thirds of screen navigates
- [x] Swipe left/right navigates (mobile)
- [x] Index button opens grid view
- [x] Clicking a grid item enters exhibition at that photo
- [x] Escape key closes index view
- [x] Photo numbers visible (bottom-right in exhibition, overlay in grid)
- [x] Letterbox/pillarbox correct for portrait and landscape photos
- [x] Blur-up placeholders load before full images in index grid
- [x] `prefers-reduced-motion` uses simple crossfade
- [x] Mobile: simple crossfade transition used
- [x] Mobile: touch/swipe works
- [x] No WebGL2: CSS fallback slideshow works
- [x] Keyboard navigation accessible (tab order, focus rings)
- [x] All images have `alt` text
- [x] Responsive at 375px, 768px, 1440px, 2560px

## Stack

- **Vite** — build tool
- **OGL** — minimal WebGL library
- **sharp** — server-side image processing (dev only)
- **Cormorant Garamond** — editorial serif (Google Fonts)
