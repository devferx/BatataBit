// Compara dos carpetas de screenshots (375.png / 1024.png) con pixelmatch.
// Uso: node tests/visual/compare.mjs <baseline> <actual> <diff-salida>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [baseDir, newDir, diffDir] = process.argv.slice(2);
mkdirSync(diffDir, { recursive: true });
let failed = false;

for (const width of [375, 1024]) {
  const a = PNG.sync.read(readFileSync(`${baseDir}/${width}.png`));
  const b = PNG.sync.read(readFileSync(`${newDir}/${width}.png`));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`${width}px: SIZE MISMATCH ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    failed = true;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const px = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 });
  writeFileSync(`${diffDir}/${width}.png`, PNG.sync.write(diff));
  console.log(`${width}px: ${a.width}x${a.height}, ${px} different pixels`);
  if (px > 0) failed = true;
}
process.exit(failed ? 1 : 0);
