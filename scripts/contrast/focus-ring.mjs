// Mide el anillo de foco real: recorre con Tab todos los elementos enfocables y compara el color del
// anillo con los píxeles de fondo a ambos lados (el hueco entre el elemento y el anillo, y el exterior).
// Mínimo exigido: 3:1 (WCAG 1.4.11 / 2.4.11).
// Uso: node scripts/contrast/focus-ring.mjs <url> [anchos separados por coma]
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { contrast } from "./contrast.mjs";

const [url, widthsArg] = process.argv.slice(2);
if (!url) {
  console.error("Uso: node scripts/contrast/focus-ring.mjs <url> [anchos]");
  process.exit(1);
}
const widths = (widthsArg ?? "375,834,1440").split(",").map(Number);
const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const browser = await chromium.launch();
let worst = Infinity;
let failures = 0;

for (const width of widths) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.appendChild(probe);
    const px = (v) => { probe.style.width = v; return probe.getBoundingClientRect().width; };
    const out = { width: px(cs.getPropertyValue("--focus-ring-width").trim()), offset: px(cs.getPropertyValue("--focus-ring-offset").trim()) };
    probe.remove();
    return out;
  });
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      return { label: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}"`, x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (!info) break;
    const key = info.label + info.x + info.y;
    if (seen.has(key)) break;
    seen.add(key);
    await page.waitForTimeout(60);
    const info2 = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const pad = Math.ceil(ring.offset + ring.width + 6);
    const vp = page.viewportSize();
    const cx = Math.max(0, info2.x - pad), cy = Math.max(0, info2.y - pad);
    const clip = { x: cx, y: cy, width: Math.min(vp.width - cx, info2.x + info2.w + pad - cx), height: Math.min(vp.height - cy, info2.y + info2.h + pad - cy) };
    if (clip.width <= 0 || clip.height <= 0 || info2.x < 0 || info2.x + info2.w > vp.width) { console.log(`${width}px ${info.label.padEnd(34)} skipped (outside the viewport)`); continue; }
    const png = PNG.sync.read(await page.screenshot({ clip }));
    const ox = info2.x - clip.x, oy = info2.y - clip.y;
    const at = (x, y) => { const k = (Math.round(y) * png.width + Math.round(x)) * 4; return hexOf(png.data[k], png.data[k + 1], png.data[k + 2]); };
    const samples = [];
    const spans = [0.25, 0.4, 0.5, 0.6, 0.75];
    const d = { gap: ring.offset / 2, ring: ring.offset + ring.width / 2, outer: ring.offset + ring.width + 2 };
    for (const f of spans) {
      const px = ox + info2.w * f, py = oy + info2.h * f;
      for (const [name, dist] of Object.entries(d)) {
        samples.push([name, "top", at(px, oy - dist)], [name, "bottom", at(px, oy + info2.h + dist)], [name, "left", at(ox - dist, py)], [name, "right", at(ox + info2.w + dist, py)]);
      }
    }
    // Color del anillo: el calculado por el navegador (las muestras junto al borde del anillo pueden caer a medio píxel).
    const rgb = (await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor)).match(/\d+/g).map(Number);
    const ringColor = hexOf(rgb[0], rgb[1], rgb[2]);
    let min = Infinity;
    for (const [name, , color] of samples) if (name !== "ring") min = Math.min(min, contrast(ringColor, color));
    worst = Math.min(worst, min);
    if (min < 3) failures++;
    console.log(`${width}px ${info.label.padEnd(34)} ring ${ringColor} min contrast vs surroundings ${min.toFixed(2)} ${min >= 3 ? "ok" : "FAIL"}`);
  }
  await page.close();
}
console.log(`worst ${worst.toFixed(2)}:1, ${failures} failing elements`);
await browser.close();
process.exit(failures ? 1 : 0);
