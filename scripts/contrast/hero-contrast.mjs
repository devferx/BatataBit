// Contraste mínimo del h1 y del lead del hero sobre el degradado real renderizado.
// Pone el texto transparente, captura el fondo y mide cada píxel bajo las líneas de texto reales.
// Uso: node scripts/contrast/hero-contrast.mjs <url> [--widths 320,375,...] [--options id,id]
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { contrast } from "./contrast.mjs";
import { OPTIONS, gradientCss, leadColorCss, layoutCss } from "./hero-preview.mjs";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const widths = flag("--widths", "320,375,600,768,930,1024,1200,1440,1920").split(",").map(Number);
const only = flag("--options", "").split(",").filter(Boolean);
const url = args[0];
if (!url) {
  console.error("Uso: node scripts/contrast/hero-contrast.mjs <url> [--widths ...] [--options ...]");
  process.exit(1);
}

const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const browser = await chromium.launch();
const summary = {};

for (const opt of OPTIONS.filter((o) => !only.length || only.includes(o.id))) {
  const perWidth = [];
  for (const width of widths) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: gradientCss(opt.stop) + layoutCss(width) + "header h1,header p{color:transparent!important}",
    });
    const lines = await page.evaluate(() =>
      ["header h1", "header p"].map((sel) => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(sel));
        return [...range.getClientRects()].map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
      }),
    );
    const png = PNG.sync.read(await page.screenshot());
    const min = (rects, fg) => {
      let m = Infinity;
      for (const r of rects)
        for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(png.height, Math.ceil(r.y + r.h)); y++)
          for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(png.width, Math.ceil(r.x + r.w)); x++) {
            const k = (y * png.width + x) * 4;
            m = Math.min(m, contrast(fg, hexOf(png.data[k], png.data[k + 1], png.data[k + 2])));
          }
      return m;
    };
    perWidth.push({ width, h1: min(lines[0], "#FFFFFF"), lead: min(lines[1], opt.lead) });
    await page.close();
  }
  const row = (key) => Math.min(...perWidth.map((p) => p[key]));
  summary[opt.id] = { label: opt.label, minH1: +row("h1").toFixed(2), minLead: +row("lead").toFixed(2), perWidth: perWidth.map((p) => ({ ...p, h1: +p.h1.toFixed(2), lead: +p.lead.toFixed(2) })) };
  console.log(`${opt.label}\n  min h1 ${row("h1").toFixed(2)} | min lead ${row("lead").toFixed(2)} | ` + perWidth.map((p) => `${p.width}:${p.lead.toFixed(2)}`).join(" "));
}
await browser.close();
if (process.env.JSON_OUT) (await import("node:fs")).writeFileSync(process.env.JSON_OUT, JSON.stringify(summary, null, 2));
