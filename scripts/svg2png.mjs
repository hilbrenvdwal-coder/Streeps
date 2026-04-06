import sharp from 'sharp';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const svgDir = 'assets/aurora/svg';
const outDir = 'assets/aurora';
const scale = 2;

for (const file of readdirSync(svgDir).filter(f => f.endsWith('.svg'))) {
  let svg = readFileSync(join(svgDir, file), 'utf-8');

  // Extract viewBox dimensions
  const vb = svg.match(/viewBox="0 0 (\d+\.?\d*) (\d+\.?\d*)"/);
  if (!vb) { console.error(`SKIP ${file}: no viewBox`); continue; }
  const [w, h] = [parseFloat(vb[1]), parseFloat(vb[2])];

  // Add rounded-rect clipPath (borderRadius 25) right after <svg ...>
  const clipDef = `<defs><clipPath id="clip"><rect x="0" y="0" width="${w}" height="${h}" rx="25" ry="25"/></clipPath></defs>`;
  const clipGroup = `<g clip-path="url(#clip)">`;

  // Wrap all content in clip group
  svg = svg.replace(/<svg([^>]*)>/, `<svg$1>${clipDef}${clipGroup}`);
  svg = svg.replace(/<\/svg>/, `</g></svg>`);

  // Set explicit pixel dimensions for sharp
  svg = svg.replace(/width="(\d+\.?\d*)"/, `width="${w * scale}"`);
  svg = svg.replace(/height="(\d+\.?\d*)"/, `height="${h * scale}"`);

  const pngPath = join(outDir, file.replace('.svg', '.png'));
  try {
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    const m = await sharp(pngPath).metadata();
    console.log(`OK ${file} → ${m.width}x${m.height}`);
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message}`);
  }
}
