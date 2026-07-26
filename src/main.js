import photos from './photos.json';

const BASE = import.meta.env.BASE_URL;

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
let indexOpen = false;

const imgA = document.getElementById('img-a');
const imgB = document.getElementById('img-b');
const numEl = document.getElementById('num');
const panel = document.getElementById('index-panel');
const grid  = document.getElementById('index-grid');

// which slot is currently showing
let activeSlot = imgA;
let hiddenSlot = imgB;

// ── Show photo ────────────────────────────────────────────────────
function show(idx) {
  idx = ((idx % photos.length) + photos.length) % photos.length;
  current = idx;
  const photo = photos[idx];
  const src = imgSrc(photo, targetWidth());

  numEl.textContent = photo.num;
  numEl.classList.add('show');

  const incoming = hiddenSlot;
  const outgoing = activeSlot;

  function swap() {
    incoming.classList.add('visible');
    outgoing.classList.remove('visible');
    activeSlot = incoming;
    hiddenSlot = outgoing;
    preload(idx + 1);
    preload(idx - 1);
  }

  incoming.onload = null;
  incoming.onerror = null;
  incoming.onload = swap;
  incoming.onerror = swap;
  incoming.src = src;
}

// ── Preload ───────────────────────────────────────────────────────
const preloaded = new Set();
function preload(idx) {
  if (idx < 0 || idx >= photos.length || preloaded.has(idx)) return;
  preloaded.add(idx);
  const img = new Image();
  img.src = imgSrc(photos[idx], targetWidth());
}

// ── Index panel ───────────────────────────────────────────────────
function buildGrid() {
  if (grid.children.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const item = e.target;
      const img = item.querySelector('img');
      if (!img.src) {
        const p = photos[+item.dataset.index];
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
    item.style.aspectRatio = `${p.width} / ${p.height}`;

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
  buildGrid();
  Array.from(grid.children).forEach((el, i) => el.classList.toggle('active', i === current));
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
  if (jumpTo !== undefined && jumpTo !== current) show(jumpTo);
}

// ── Input ─────────────────────────────────────────────────────────
document.getElementById('btn-index').addEventListener('click', openIndex);
document.getElementById('btn-close').addEventListener('click', () => closeIndex());

document.getElementById('btn-prev').addEventListener('click', e => {
  e.stopPropagation();
  show(current - 1);
});
document.getElementById('btn-next').addEventListener('click', e => {
  e.stopPropagation();
  show(current + 1);
});

document.addEventListener('keydown', e => {
  if (indexOpen) { if (e.key === 'Escape') closeIndex(); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') show(current + 1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   show(current - 1);
});

document.getElementById('stage').addEventListener('click', e => {
  if (indexOpen) return;
  e.clientX < window.innerWidth / 2 ? show(current - 1) : show(current + 1);
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
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 30 && ady < 30) return;
  if (adx > ady) dx < 0 ? show(current + 1) : show(current - 1);
  else           dy < 0 ? show(current + 1) : show(current - 1);
}, { passive: true });

// ── Init ──────────────────────────────────────────────────────────
imgA.classList.add('visible');
imgA.onload = () => { numEl.classList.add('show'); };
imgA.src = imgSrc(photos[0], targetWidth());
imgA.alt = `Photograph ${photos[0].num}`;
numEl.textContent = photos[0].num;
preload(1);
preload(2);
