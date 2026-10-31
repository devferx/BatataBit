import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
// Uso: node tests/visual/locate-diff.mjs <carpeta-con-diff2> <url> 
// Atribuye los píxeles distintos (rojo en diff2/*.png) al elemento DOM más pequeño que los contiene.
const S = process.argv[2];
const URL = process.argv[3];
const b = await chromium.launch();
for (const w of [375, 1024]) {
  const d = PNG.sync.read(readFileSync(`${S}/diff2/${w}.png`));
  // pixelmatch marca diferencias en rojo (255,0,0)
  const pts = [];
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
    const i = (y * d.width + x) * 4;
    if (d.data[i] === 255 && d.data[i + 1] === 0 && d.data[i + 2] === 0) pts.push([x, y]);
  }
  const page = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const rects = await page.evaluate(() => [...document.querySelectorAll("body *")].map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { sel: e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ").join(".") : ""), x: r.x, y: r.y + scrollY, w: r.width, h: r.height, color: cs.color, bg: cs.backgroundColor }; }));
  const owners = new Map();
  for (const [x, y] of pts) {
    const hits = rects.filter(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && r.w * r.h < 1e6);
    const smallest = hits.sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const k = smallest ? smallest.sel : "none";
    owners.set(k, (owners.get(k) ?? 0) + 1);
  }
  const ys = pts.map(p => p[1]);
  console.log(w, "diff px:", pts.length, "y-range:", Math.min(...ys), Math.max(...ys), Object.fromEntries(owners));
}
await b.close();
