import photos from './photos.json';
import { Exhibition } from './exhibition.js';
import { IndexView } from './index-view.js';

// ── WebGL capability check ────────────────────────────────────────
function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

// ── Custom cursor ─────────────────────────────────────────────────
function initCursor() {
  const el = document.createElement('div');
  el.id = 'cursor';
  document.body.appendChild(el);
  document.addEventListener('mousemove', (e) => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  });
  document.addEventListener('mouseleave', () => { el.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
}

// ── Number display ─────────────────────────────────────────────────
function setNum(index) {
  const el = document.getElementById('photo-num');
  el.textContent = photos[index].num;
  el.classList.remove('visible');
  void el.offsetWidth; // reflow to restart transition
  el.classList.add('visible');
}

// ── App init ──────────────────────────────────────────────────────
function init() {
  initCursor();

  const canvas = document.getElementById('gl-canvas');
  const btnIndex = document.getElementById('btn-index');
  const btnExhibition = document.getElementById('btn-exhibition');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const exhibitionUI = document.getElementById('exhibition-ui');
  const indexViewEl = document.getElementById('index-view');

  let exhibition;
  let indexView;
  let inExhibition = true;

  // Index-view show/hide helpers
  const showIndex = () => {
    inExhibition = false;
    exhibition.stopAutoAdvance();
    indexView.open(exhibition.currentIndex);
    exhibitionUI.style.visibility = 'hidden';
  };

  const showExhibition = (index) => {
    inExhibition = true;
    indexView.close();
    exhibitionUI.style.visibility = 'visible';

    if (index !== exhibition.currentIndex) {
      exhibition.showInstant(index);
    }
    exhibition.startAutoAdvance();
    canvas.focus();
  };

  if (!hasWebGL2()) {
    // Fallback: CSS background-image slideshow
    document.getElementById('app').classList.add('no-webgl');
    const fallback = document.getElementById('fallback-img');
    let idx = 0;
    const showFallback = (i) => {
      const p = photos[i];
      const size = p.sizes[p.sizes.length - 1];
      fallback.style.backgroundImage = `url(${p.dir}/${size}.webp)`;
      setNum(i);
    };
    showFallback(0);
    setInterval(() => { idx = (idx + 1) % photos.length; showFallback(idx); }, 6000);

    // Wire up basic controls
    btnPrev.addEventListener('click', () => { idx = (idx - 1 + photos.length) % photos.length; showFallback(idx); });
    btnNext.addEventListener('click', () => { idx = (idx + 1) % photos.length; showFallback(idx); });
    return;
  }

  // WebGL path
  exhibition = new Exhibition(canvas, photos, (index) => {
    setNum(index);
  });

  indexView = new IndexView(photos, (index) => {
    showExhibition(index);
  });

  // UI buttons
  btnIndex.addEventListener('click', showIndex);
  btnExhibition.addEventListener('click', () => showExhibition(exhibition.currentIndex));
  btnPrev.addEventListener('click', () => {
    exhibition.stopAutoAdvance();
    exhibition.prev();
    exhibition.startAutoAdvance();
  });
  btnNext.addEventListener('click', () => {
    exhibition.stopAutoAdvance();
    exhibition.next();
    exhibition.startAutoAdvance();
  });

  // Keyboard: Escape closes index
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !inExhibition) {
      showExhibition(exhibition.currentIndex);
    }
  });

  // Show UI chrome with delay (let the image render first)
  exhibition.showInstant(0);
  exhibition.startAutoAdvance();

  setTimeout(() => {
    document.getElementById('photo-num').classList.add('visible');
    btnIndex.classList.add('visible');
  }, 800);

  // Make canvas keyboard focusable for arrow key nav
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('aria-label', 'Photography exhibition — use arrow keys to navigate');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
