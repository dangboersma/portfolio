import photos from './photos.json';

const BASE = import.meta.env.BASE_URL;
const ADVANCE_MS = 7000;
const TRANSITION_MS = 1000;

// ── Helpers ──────────────────────────────────────────────────────
function imgSrc(photo, targetW) {
  const w = photo.sizes.reduce((best, s) =>
    s >= targetW && (best === 0 || s < best) ? s : best, 0)
    || photo.sizes[photo.sizes.length - 1];
  return `${BASE}${photo.dir}/${w}.webp`;
}

function targetWidth() {
  return window.innerWidth > 1400 ? 2400 : window.innerWidth > 900 ? 1600 : 800;
}

// ── State ─────────────────────────────────────────────────────────
let current = 0;
let active = 0;          // which img slot is on top
let busy = false;
let autoTimer = null;
let indexOpen = false;

const imgs = [
  document.getElementById('img-a'),
  document.getElementById('img-b'),
];
const numEl   = document.getElementById('num');
const panel   = document.getElementById('index-panel');
const grid    = document.getElementById('index-grid');

// ── Preload cache ─────────────────────────────────────────────────
const cache = new Map();
function preload(idx) {
  if (idx < 0 || idx >= photos.length || cache.has(idx)) return;
  const img = new Image();
  img.src = imgSrc(photos[idx], targetWidth());
  cache.set(idx, img);
}

// ── Show photo ───────────────────────────────────────────────────
function show(idx, instant = false) {
  if (busy && !instant) return;
  idx = (idx + photos.length) % photos.length;

  const next = 1 - active;
  const photo = photos[idx];
  const src = imgSrc(photo, targetWidth());

  busy = true;

  function swap() {
    current = idx;
    numEl.textContent = photo.num;
    numEl.classList.add('show');

    if (instant) {
      imgs[active].classList.remove('visible');
      imgs[next].classList.add('visible');
      active = next;
      busy = false;
    } else {
      imgs[next].classList.add('visible');
      setTimeout(() => {
        imgs[active].classList.remove('visible');
        active = next;
        setTimeout(() => { busy = false; }, TRANSITION_MS);
      }, 50);
    }

    // Preload neighbors
    preload(idx + 1);
    preload(idx - 1);
    preload(idx + 2);
  }

  // Already cached or same src
  if (cache.has(idx) && cache.get(idx).complete) {
    imgs[next].src = src;
    imgs[next].alt = `Photograph ${photo.num}`;
    swap();
    return;
  }

  imgs[next].onload = swap;
  imgs[next].onerror = swap; // show whatever we have
  imgs[next].alt = `Photograph ${photo.num}`;
  imgs[next].src = src;
  cache.set(idx, imgs[next]);
}

// ── Auto-advance ─────────────────────────────────────────────────
function startAuto() {
  stopAuto();
  autoTimer = setInterval(() => {
    if (!indexOpen && !busy) show(current + 1);
  }, ADVANCE_MS);
}
function stopAuto() {
  clearInterval(autoTimer);
  autoTimer = null;
}

function next() { show(current + 1); resetAuto(); }
function prev() { show(current - 1); resetAuto(); }
function resetAuto() { stopAuto(); startAuto(); }

// ── Index panel ──────────────────────────────────────────────────
function buildGrid() {
  if (grid.children.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const item = e.target;
      const img = item.querySelector('img');
      if (!img.src) {
        const idx = +item.dataset.index;
        const p = photos[idx];
        img.src = imgSrc(p, 800);
        img.onload = () => img.classList.add('loaded');
      }
      obs.unobserve(item);
    });
  }, { rootMargin: '200px' });

  photos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'grid-item';
    item.dataset.index = i;
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.style.backgroundImage = `url(${p.placeholder})`;
    item.style.backgroundSize = 'cover';
    item.style.backgroundPosition = 'center';

    const img = document.createElement('img');
    img.alt = `Photograph ${p.num}`;

    const num = document.createElement('span');
    num.className = 'item-num';
    num.textContent = p.num;

    item.appendChild(img);
    item.appendChild(num);
    grid.appendChild(item);

    const select = () => closeIndex(i);
    item.addEventListener('click', select);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });

    obs.observe(item);
  });
}

function openIndex() {
  indexOpen = true;
  stopAuto();
  buildGrid();

  // Highlight current
  Array.from(grid.children).forEach((el, i) => {
    el.classList.toggle('active', i === current);
  });
  // Scroll current into view
  const cur = grid.children[current];
  if (cur) cur.scrollIntoView({ block: 'center' });

  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('open'));
  document.getElementById('btn-close').focus();
}

function closeIndex(jumpTo) {
  indexOpen = false;
  panel.classList.remove('open');
  panel.addEventListener('transitionend', () => panel.classList.add('hidden'), { once: true });

  if (jumpTo !== undefined && jumpTo !== current) {
    show(jumpTo, true);
  }
  startAuto();
}

// ── Input ─────────────────────────────────────────────────────────
document.getElementById('btn-index').addEventListener('click', openIndex);
document.getElementById('btn-close').addEventListener('click', () => closeIndex());
document.getElementById('btn-prev').addEventListener('click', prev);
document.getElementById('btn-next').addEventListener('click', next);

// Keyboard
document.addEventListener('keydown', e => {
  if (indexOpen) {
    if (e.key === 'Escape') closeIndex();
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev();
});

// Click stage (left = prev, right = next)
document.getElementById('stage').addEventListener('click', e => {
  if (indexOpen) return;
  e.clientX < window.innerWidth / 2 ? prev() : next();
});

// Touch swipe
let tx = 0, ty = 0;
document.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (indexOpen) return;
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    dx < 0 ? next() : prev();
  }
}, { passive: true });

// ── Custom cursor ────────────────────────────────────────────────
const cursor = document.createElement('div');
cursor.id = 'cursor';
document.body.appendChild(cursor);
document.addEventListener('mousemove', e => {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top  = e.clientY + 'px';
});

// ── Init ─────────────────────────────────────────────────────────
show(0, true);
setTimeout(() => numEl.classList.add('show'), 600);
startAuto();
preload(1); preload(2);
