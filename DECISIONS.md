# Architecture & Decisions

## Stack

**Vite** — build tool. Zero-config, fast HMR, handles ES modules and asset hashing cleanly. No framework overhead needed for a static gallery.

**Vanilla JS (ES modules)** — no React/Vue/Svelte. The site is three views and a render loop; a framework would add 30KB+ for no benefit.

**OGL** — minimal WebGL library (~15KB gzip). Provides Renderer, Program, Texture, and geometry primitives without Three.js's 600KB. Used only for the exhibition canvas.

**sharp** (Node.js) — server-side image processing. Generates WebP at 400/800/1600/2400px from source originals. Runs locally once; processed images are committed to `public/images/`.

**No database, no CMS** — confirmed unnecessary. Photos are static files; the manifest (`src/photos.json`) is generated from the source directory and committed.

## Image pipeline

Source photos → sharp → WebP at four widths (400, 800, 1600, 2400px) → `public/images/NN/`.

A 20px-wide JPEG placeholder is base64-encoded into `photos.json` for blur-up loading. The exhibition canvas uses 1600px (or 800px on mobile). The index grid uses 800px. Original files are gitignored.

## Typography

**Cormorant Garamond** (Google Fonts) — a high-contrast editorial serif derived from Claude Garamond's Renaissance letterforms. Museum-catalog quality at display sizes; used only for numbers and the minimal navigation text.

## WebGL transition architecture

Two textures (`tFrom`, `tTo`) on a fullscreen triangle. A `uProgress` uniform (0→1) drives all phases.

**Full quality path (desktop):**
- Phase 1 (0–0.5): drop 1 impact → ripple displacement → A dissolves to Kuwahara-filtered "watercolor" version via domain-warped UV
- Mid-transition: curl-noise swirl peaks; paper grain overlay; Sobel edge darkening for pigment pooling
- Phase 2 (0.55–1.0): drop 2 impact → radial reveal mask expands from drop 2 position → B blooms from watercolor to sharp

**Kuwahara filter:** radius-2, 4×9 = 36 texture samples per pixel per texture. Selects the quadrant with lowest luminance variance, producing oil-paint-like color regions with preserved edges.

**Tunable knobs:** see README.

**Fallback paths:**
- Mobile / low-power (detected by `window.innerWidth < 768` or `Mobi` UA): simple smoothstep crossfade shader, 700ms
- `prefers-reduced-motion`: same simple crossfade
- No WebGL2: CSS background-image slideshow

## Image display

`contain` mode (letterbox/pillarbox) computed in the fragment shader from `uFromAspect`, `uToAspect`, and `uScreenAspect` uniforms. Shows the full image against black — respects the photographer's composition.

## Deploy

GitHub Pages via `actions/deploy-pages`. The workflow runs `npm ci && npm run build` and deploys `dist/`. Processed images are committed to the repo so CI needs no access to source photos.

## Photo numbering

Sequential (01–53), ordered by date prefix where the filename starts with YYYYMMDD, then alphabetically. No titles, captions, or metadata are displayed anywhere.
