// Verifica que TODOS los píxeles distintos caen dentro de elementos que usan Soft Orange
// (fondo o color de texto = #FFE9D4 / #FFE9D5, o descendientes de un fondo Soft Orange).
// Uso: node tests/visual/check-soft-orange.mjs <carpeta-con-diff2> <url>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
const [S, url] = process.argv.slice(2);
const b = await chromium.launch();
let outside = 0;
for (const w of [375, 1024]) {
  const d = PNG.sync.read(readFileSync(`${S}/diff2/${w}.png`));
  const page = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const rects = await page.evaluate(() => {
    const soft = /rgb\(255, 233, (212|213)\)/;
    const out = [];
    for (const e of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(e);
      const own = soft.test(cs.backgroundColor) || (soft.test(cs.color) && e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
      if (!own) continue;
      const r = e.getBoundingClientRect();
      out.push({ sel: e.tagName.toLowerCase() + "." + e.className, x: r.x, y: r.y + scrollY, w: r.width, h: r.height });
    }
    return out;
  });
  let total = 0, miss = 0;
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
    const i = (y * d.width + x) * 4;
    if (!(d.data[i] === 255 && d.data[i + 1] === 0 && d.data[i + 2] === 0)) continue;
    total++;
    if (!rects.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) miss++;
  }
  console.log(`${w}px: ${total} diff px, ${miss} outside Soft Orange elements; regions:`, rects.map(r => `${r.sel}@y${Math.round(r.y)}`));
  outside += miss;
}
await b.close();
process.exit(outside ? 1 : 0);
