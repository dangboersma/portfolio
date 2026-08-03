import sharp from 'sharp';
import { readdir, mkdir, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.resolve(__dirname, '..');
const SRC_DIR  = path.join(ROOT, 'source-photos');
const OUT_DIR  = path.join(ROOT, 'public', 'images');
const MANIFEST = path.join(ROOT, 'src', 'photos.json');

// Skip obvious duplicates / non-photo files
const EXCLUDE = new Set([
  '_DSC0731-Enhanced2sharp.jpg',             // kept -2 version
  '_DSC97222.jpg',                            // kept -2 version
  '607A9727.jpg',                             // kept _DxO version
  'sunset_over_7_sharp_16x20.jpg',            // kept -2 version
  'IMG_20210731_201106-Pano-2-Edit copy.jpg', // kept larger Pano version
]);

const SIZES = [400, 800, 1600, 2400];

// Files pinned to the front, in order
const PIN_FIRST = [
  'CathedralofManhattan.jpg',
];

// Sort: pinned first, then YYYYMMDD prefix, then alphabetical
function sortKey(name) {
  const pin = PIN_FIRST.indexOf(name);
  if (pin >= 0) return `0_${String(pin).padStart(4, '0')}_${name}`;
  const m = name.match(/^(\d{8})/);
  return m ? `1_${m[1]}_${name}` : `2_${name.toLowerCase()}`;
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch { return false; }
}

async function main() {
  const all = await readdir(SRC_DIR);
  const jpgs = all
    .filter(f => /\.(jpg|jpeg)$/i.test(f) && !EXCLUDE.has(f))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  console.log(`\n📷  Processing ${jpgs.length} photographs…\n`);

  const manifest = [];

  for (let i = 0; i < jpgs.length; i++) {
    const name  = jpgs[i];
    const num   = String(i + 1).padStart(2, '0');
    const src   = path.join(SRC_DIR, name);
    const outD  = path.join(OUT_DIR, num);

    await mkdir(outD, { recursive: true });

    let meta;
    try {
      meta = await sharp(src).metadata();
    } catch (err) {
      console.warn(`  ⚠  Skipping ${name}: ${err.message}`);
      continue;
    }
    const { width, height } = meta;
    console.log(`  [${num}] ${name}  (${width}×${height})`);

    // Generate WebP at each size
    const builtSizes = [];
    for (const w of SIZES) {
      const out = path.join(outD, `${w}.webp`);
      if (!(await exists(out))) {
        if (w > width * 1.05) continue; // don't upscale >5%
        await sharp(src)
          .resize(w)
          .webp({ quality: 85, effort: 4 })
          .toFile(out);
      }
      builtSizes.push(w);
    }

    // Always ensure at least the 400px version exists
    const smallOut = path.join(outD, '400.webp');
    if (!(await exists(smallOut))) {
      await sharp(src).resize(400).webp({ quality: 85, effort: 4 }).toFile(smallOut);
      if (!builtSizes.includes(400)) builtSizes.unshift(400);
    }

    // Low-res placeholder (20px wide, base64)
    const placeholderBuf = await sharp(src)
      .resize(20)
      .jpeg({ quality: 40 })
      .toBuffer();
    const placeholder = `data:image/jpeg;base64,${placeholderBuf.toString('base64')}`;

    manifest.push({
      num,
      dir: `images/${num}`,
      placeholder,
      width,
      height,
      sizes: SIZES.filter(w => builtSizes.includes(w) || w === 400),
    });
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✓  ${manifest.length} photos written to ${MANIFEST}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
