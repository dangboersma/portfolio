import { Renderer, Triangle, Program, Mesh, Texture } from 'ogl';
import { vertex, fragmentFull, fragmentSimple } from './shader.js';

const TRANSITION_MS = 3200;
const SIMPLE_MS = 700;
const AUTO_ADVANCE_MS = 6000;

function ease(t) {
  // Custom ease: slow start, fast middle, slow end — good for long transitions
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class Exhibition {
  constructor(canvas, photos, onIndexChange) {
    this.canvas = canvas;
    this.photos = photos;
    this.onIndexChange = onIndexChange;
    this.currentIndex = 0;
    this.isTransitioning = false;
    this.textures = new Map();
    this._raf = null;
    this._autoTimer = null;
    this._progress = 0;
    this._transStart = 0;
    this._transFromIdx = 0;
    this._transToIdx = 0;

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
    this.useSimple = this.prefersReducedMotion || this.isMobile;

    this._initWebGL();
    this._initInput();
  }

  _initWebGL() {
    this.renderer = new Renderer({
      canvas: this.canvas,
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: false,
      antialias: false,
      webgl2: true,
    });
    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    this.geo = new Triangle(gl);

    const frag = this.useSimple ? fragmentSimple : fragmentFull;
    this.program = new Program(gl, {
      vertex,
      fragment: frag,
      uniforms: {
        tFrom:         { value: this._blankTex() },
        tTo:           { value: this._blankTex() },
        uProgress:     { value: 0 },
        uDrop1:        { value: [0.3, 0.3] },
        uDrop2:        { value: [0.6, 0.65] },
        uFromAspect:   { value: 1 },
        uToAspect:     { value: 1 },
        uScreenAspect: { value: window.innerWidth / window.innerHeight },
      },
    });

    this.mesh = new Mesh(gl, { geometry: this.geo, program: this.program });
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _blankTex() {
    const gl = this.renderer.gl;
    const t = new Texture(gl, { width: 1, height: 1 });
    t.image = new Uint8Array([0, 0, 0, 255]);
    return t;
  }

  _resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.program.uniforms.uScreenAspect.value =
      window.innerWidth / window.innerHeight;
    this._render();
  }

  _render() {
    this.renderer.render({ scene: this.mesh });
  }

  // ── Texture loading ──────────────────────────────────────────────
  loadTexture(index) {
    if (this.textures.has(index)) return this.textures.get(index);
    const gl = this.renderer.gl;
    const tex = new Texture(gl, {
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
    });
    this.textures.set(index, tex);

    const photo = this.photos[index];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
      if (index === this.currentIndex && !this.isTransitioning) {
        this.program.uniforms.tFrom.value = tex;
        this.program.uniforms.uFromAspect.value = photo.width / photo.height;
        this._render();
      }
    };
    // Use 1600px for exhibition quality; fall back to 800px on mobile
    const sizes = photo.sizes;
    const target = this.isMobile
      ? (sizes.includes(800) ? 800 : sizes[sizes.length - 1])
      : (sizes.includes(1600) ? 1600 : sizes[sizes.length - 1]);
    img.src = `${import.meta.env.BASE_URL}${photo.dir}/${target}.webp`;
    return tex;
  }

  preloadAround(index) {
    const load = (i) => {
      if (i >= 0 && i < this.photos.length) this.loadTexture(i);
    };
    load(index);
    load(index + 1);
    load(index - 1);
    load(index + 2);
  }

  // ── Show photo (instant, no transition) ─────────────────────────
  showInstant(index) {
    this.currentIndex = index;
    const tex = this.loadTexture(index);
    const photo = this.photos[index];
    this.program.uniforms.tFrom.value = tex;
    this.program.uniforms.uFromAspect.value = photo.width / photo.height;
    this.program.uniforms.uProgress.value = 0;
    this._render();
    this.onIndexChange(index);
    this.preloadAround(index);
  }

  // ── Transition to photo ──────────────────────────────────────────
  transitionTo(toIndex) {
    if (this.isTransitioning) return;
    if (toIndex === this.currentIndex) return;
    if (toIndex < 0 || toIndex >= this.photos.length) return;

    const fromIndex = this.currentIndex;
    const texFrom = this.loadTexture(fromIndex);
    const texTo = this.loadTexture(toIndex);

    this.program.uniforms.tFrom.value = texFrom;
    this.program.uniforms.tTo.value = texTo;
    this.program.uniforms.uFromAspect.value =
      this.photos[fromIndex].width / this.photos[fromIndex].height;
    this.program.uniforms.uToAspect.value =
      this.photos[toIndex].width / this.photos[toIndex].height;

    // Random drop positions (avoid extremes)
    this.program.uniforms.uDrop1.value = [
      0.2 + Math.random() * 0.6,
      0.15 + Math.random() * 0.5,
    ];
    this.program.uniforms.uDrop2.value = [
      0.2 + Math.random() * 0.6,
      0.15 + Math.random() * 0.5,
    ];

    this.isTransitioning = true;
    this._transFromIdx = fromIndex;
    this._transToIdx = toIndex;
    this._transStart = performance.now();

    const duration = this.useSimple ? SIMPLE_MS : TRANSITION_MS;

    const tick = (now) => {
      const raw = Math.min((now - this._transStart) / duration, 1.0);
      const p = this.useSimple ? raw : ease(raw);
      this.program.uniforms.uProgress.value = p;
      this._render();

      if (raw < 1.0) {
        this._raf = requestAnimationFrame(tick);
      } else {
        // Transition complete
        this.currentIndex = toIndex;
        this.program.uniforms.tFrom.value = texTo;
        this.program.uniforms.uFromAspect.value =
          this.photos[toIndex].width / this.photos[toIndex].height;
        this.program.uniforms.uProgress.value = 0;
        this._render();
        this.isTransitioning = false;
        this.onIndexChange(toIndex);
        this.preloadAround(toIndex);
      }
    };
    this._raf = requestAnimationFrame(tick);
  }

  next() {
    const next = (this.currentIndex + 1) % this.photos.length;
    this.transitionTo(next);
  }

  prev() {
    const prev = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
    this.transitionTo(prev);
  }

  // ── Auto-advance ─────────────────────────────────────────────────
  startAutoAdvance() {
    this.stopAutoAdvance();
    this._autoTimer = setInterval(() => {
      if (!this.isTransitioning) this.next();
    }, AUTO_ADVANCE_MS);
  }

  stopAutoAdvance() {
    if (this._autoTimer) { clearInterval(this._autoTimer); this._autoTimer = null; }
  }

  // ── Input ────────────────────────────────────────────────────────
  _initInput() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('index-view').classList.contains('visible')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        this.stopAutoAdvance();
        this.next();
        this.startAutoAdvance();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        this.stopAutoAdvance();
        this.prev();
        this.startAutoAdvance();
      }
    });

    // Click zones (left third = prev, right third = next, middle = pause/play)
    this.canvas.addEventListener('click', (e) => {
      if (document.getElementById('index-view').classList.contains('visible')) return;
      const x = e.clientX / window.innerWidth;
      if (x < 0.35) { this.stopAutoAdvance(); this.prev(); this.startAutoAdvance(); }
      else if (x > 0.65) { this.stopAutoAdvance(); this.next(); this.startAutoAdvance(); }
    });

    // Touch / swipe
    let tx0 = 0, ty0 = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - tx0;
      const dy = e.changedTouches[0].clientY - ty0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        this.stopAutoAdvance();
        dx < 0 ? this.next() : this.prev();
        this.startAutoAdvance();
      }
    }, { passive: true });
  }
}
