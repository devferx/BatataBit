// Renderiza el hero (375 y 1024) con las tres opciones de D2 y la tarjeta de plan con radio 15 vs 8 (D4).
// No modifica archivos: inyecta CSS en la página construida.
// Uso: node scripts/contrast/render-d2-options.mjs <url> [carpeta=evidence/tests/visual/d2-options]
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { OPTIONS, gradientCss, leadColorCss, layoutCss } from "./hero-preview.mjs";

const [url, outDir = "evidence/tests/visual/d2-options"] = process.argv.slice(2);
if (!url) {
  console.error("Uso: node scripts/contrast/render-d2-options.mjs <url> [carpeta]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const shot = async (width, css, file, selectorOrClip) => {
  const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: css });
  if (selectorOrClip === "hero") {
    const bottom = await page.evaluate(() => document.querySelector("header").getBoundingClientRect().bottom);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height: Math.ceil(bottom) + 40 } });
  } else {
    const box = await page.evaluate((sel) => {
      const cards = [...document.querySelectorAll(sel)].slice(0, 2).map((e) => e.getBoundingClientRect());
      const top = Math.min(...cards.map((c) => c.top)) - 30 + scrollY;
      const left = Math.min(...cards.map((c) => c.left)) - 10;
      const right = Math.max(...cards.map((c) => c.right)) + 10;
      const bottom = Math.max(...cards.map((c) => c.bottom)) + 20 + scrollY;
      return { x: Math.max(0, left), y: Math.max(0, top), width: Math.min(innerWidth, right) - Math.max(0, left), height: bottom - top };
    }, selectorOrClip);
    await page.screenshot({ path: file, clip: box, fullPage: true });
  }
  await page.close();
};

const files = {};
for (const width of [375, 1024]) {
  for (const opt of OPTIONS) {
    const file = `${outDir}/hero-${width}-${opt.id}.png`;
    await shot(width, gradientCss(opt.stop) + leadColorCss(opt.lead) + layoutCss(width), file, "hero");
    (files[width] ??= []).push({ file, label: opt.label });
    console.log(file);
  }
}
const radius = [];
for (const r of [15, 8]) {
  const file = `${outDir}/plan-card-radius-${r}.png`;
  await shot(375, `.plan-card{border-radius:${r}px!important}`, file, ".plan-card");
  radius.push({ file, label: r === 15 ? "Radius 15px (current)" : "Radius 8px (Figma)" });
  console.log(file);
}

// Hojas comparativas: las imágenes lado a lado con su etiqueta.
const sheet = async (title, items, file, imgWidth) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const html = `<body style="margin:0;padding:16px;background:#fff;font:14px/1.3 system-ui;color:#222">
  <h3 style="margin:0 0 12px">${title}</h3>
  <div style="display:flex;gap:16px;align-items:flex-start">${items
    .map((i) => `<figure style="margin:0"><img style="display:block;width:${imgWidth}px;border:1px solid #ddd" src="data:image/png;base64,${readFileSync(i.file).toString("base64")}"><figcaption style="margin-top:6px;max-width:${imgWidth}px">${i.label}</figcaption></figure>`)
    .join("")}</div></body>`;
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(file);
};
await sheet("D2: hero at 375px", files[375], `${outDir}/compare-hero-375.png`, 360);
await sheet("D2: hero at 1024px (layout preview: 40/42 + 20/24, 466px measure, 480px tall, centred CTA)", files[1024], `${outDir}/compare-hero-1024.png`, 380);
await sheet("D4: plan card radius at 375px", radius, `${outDir}/compare-plan-card-radius.png`, 360);
await browser.close();
