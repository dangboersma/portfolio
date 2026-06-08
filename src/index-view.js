export class IndexView {
  constructor(photos, onSelect) {
    this.photos = photos;
    this.onSelect = onSelect;
    this.container = document.getElementById('index-view');
    this.grid = document.getElementById('index-grid');
    this._built = false;
  }

  open(currentIndex) {
    if (!this._built) this._build();
    this._highlight(currentIndex);

    this.container.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.container.classList.add('visible');
    });

    // Scroll current item into view
    const item = this.grid.children[currentIndex];
    if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Focus management
    document.getElementById('btn-exhibition').focus();
  }

  close() {
    this.container.classList.remove('visible');
    this.container.addEventListener('transitionend', () => {
      this.container.classList.add('hidden');
    }, { once: true });
  }

  _build() {
    this._built = true;
    this.grid.innerHTML = '';

    this.photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'index-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.index = i;

      // Blur placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.style.cssText += `background-image:url(${photo.placeholder});background-size:cover;background-position:center;`;

      // Main image (lazy)
      const img = document.createElement('img');
      img.alt = `Photograph ${photo.num}`;
      img.loading = 'lazy';
      img.decoding = 'async';

      // Use 800px for grid (or smallest available)
      const sizes = photo.sizes;
      const size = sizes.includes(800) ? 800 : sizes[0];
      img.src = `${import.meta.env.BASE_URL}${photo.dir}/${size}.webp`;
      img.onload = () => {
        img.classList.add('loaded');
        placeholder.classList.add('hidden');
      };

      const num = document.createElement('span');
      num.className = 'index-num';
      num.textContent = photo.num;

      item.appendChild(placeholder);
      item.appendChild(img);
      item.appendChild(num);
      this.grid.appendChild(item);

      // Click / keyboard select
      const select = () => {
        this.onSelect(i);
      };
      item.addEventListener('click', select);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    });
  }

  _highlight(index) {
    Array.from(this.grid.children).forEach((el, i) => {
      el.style.outline = i === index
        ? '1px solid rgba(232,226,216,0.35)'
        : '';
    });
  }
}
