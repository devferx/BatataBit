// Contraste mínimo de un texto sobre una imagen o degradado: pone el texto transparente,
// captura el fondo y mide cada píxel bajo las líneas de texto reales.
// Uso: node scripts/contrast/overlay-contrast.mjs <url> "<selector>" <#color-texto> [anchos]
// EXTRA_CSS="..." inyecta CSS de prueba antes de medir (para comparar variantes sin tocar archivos).
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { contrast } from "./contrast.mjs";

const [url, selector, fg, widthsArg] = process.argv.slice(2);
if (!url || !selector || !fg) {
  console.error('Uso: node scripts/contrast/overlay-contrast.mjs <url> "<selector>" <#color-texto> [anchos]');
  process.exit(1);
}
const widths = (widthsArg ?? "320,375,768,834,1024,1440,1920").split(",").map(Number);
const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const browser = await chromium.launch();
const row = [];
for (const width of widths) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: `${process.env.EXTRA_CSS ?? ""}${selector}{color:transparent!important}` });
  const el = await page.$(selector);
  await el.scrollIntoViewIfNeeded();
  const rects = await page.evaluate((sel) => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(sel));
    return [...range.getClientRects()].map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
  }, selector);
  const png = PNG.sync.read(await page.screenshot());
  let min = Infinity;
  for (const r of rects)
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(png.height, Math.ceil(r.y + r.h)); y++)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(png.width, Math.ceil(r.x + r.w)); x++) {
        const k = (y * png.width + x) * 4;
        min = Math.min(min, contrast(fg, hexOf(png.data[k], png.data[k + 1], png.data[k + 2])));
      }
  row.push(`${width}:${min.toFixed(2)}`);
  await page.close();
}
console.log(`${selector} ${fg} -> ${row.join(" ")}`);
await browser.close();
