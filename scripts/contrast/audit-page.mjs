// Auditoría WCAG 2.2 AA de la página renderizada: contraste de todo el texto contra su fondo real
// y de los límites de componentes (borde del botón outline, iconos de tendencia) contra 3:1.
// El texto sobre degradado/imagen se omite aquí y se mide con hero-contrast.mjs --live.
// Uso: node scripts/contrast/audit-page.mjs <url> [anchos separados por coma]
import { chromium } from "@playwright/test";

const [url, widthsArg] = process.argv.slice(2);
if (!url) {
  console.error("Uso: node scripts/contrast/audit-page.mjs <url> [anchos]");
  process.exit(1);
}
const widths = (widthsArg ?? "375,768,834,1024,1440").split(",").map(Number);
const browser = await chromium.launch();
let failures = 0;

for (const width of widths) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const parse = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const x = lum(a), y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== "none") return { skip: `${e.tagName.toLowerCase()}.${e.className || ""}` };
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) return { color: c };
      }
      return { color: { r: 255, g: 255, b: 255, a: 1 } };
    };
    const fails = [], skipped = new Set(); let checked = 0;
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const bg = bgOf(el);
      if (bg.skip) { skipped.add(bg.skip); continue; }
      const fg = parse(cs.color);
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const min = large ? 3 : 4.5;
      const r = ratio(fg, bg.color);
      checked++;
      if (r < min) fails.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${el.textContent.trim().slice(0, 30)}" ${r.toFixed(2)} < ${min}`);
    }
    // límites de componentes y gráficos: 3:1
    const ui = [];
    for (const el of document.querySelectorAll(".button--outline, .icon--trending-up, .icon--trending-down")) {
      const cs = getComputedStyle(el);
      const bg = bgOf(el.parentElement);
      if (bg.skip) continue;
      const c = el.classList.contains("button--outline") ? parse(cs.borderTopColor) : parse(cs.color);
      const r = ratio(c, bg.color);
      ui.push(`${el.className.baseVal ?? el.className}`.split(" ").slice(-1)[0] + " " + r.toFixed(2));
      if (r < 3) fails.push(`UI ${el.className.baseVal ?? el.className} ${r.toFixed(2)} < 3`);
    }
    return { checked, fails, skipped: [...skipped], ui: [...new Set(ui)] };
  });
  failures += result.fails.length;
  console.log(`${width}px: ${result.checked} text elements checked, ${result.fails.length} failures; UI checks: ${result.ui.join(", ")}; skipped (gradient/image): ${result.skipped.join(", ") || "none"}`);
  for (const f of result.fails) console.log("   FAIL", f);
  await page.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
