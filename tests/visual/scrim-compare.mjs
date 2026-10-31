// Captura la sección de la imagen sin y con el scrim (gradient.image-scrim) a 375 y 834px y arma una hoja comparativa.
// Uso: node tests/visual/scrim-compare.mjs <url> [carpeta=tests/visual/scrim]
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const [url, outDir = "tests/visual/scrim"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const files = [];
for (const width of [375, 834]) {
  for (const variant of ["before", "after"]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    if (variant === "before") await page.addStyleTag({ content: `.bitcoin-img-container{background-image:url("/assets/img/bitcoinbaby2x.jpg")!important}` });
    const el = await page.$(".bitcoin-img-container");
    const file = `${outDir}/${variant}-${width}.png`;
    await el.screenshot({ path: file });
    files.push({ file, width, variant });
    await page.close();
  }
}
const sheet = await browser.newPage({ viewport: { width: 1300, height: 800 } });
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
await sheet.setContent(`<body style="margin:0;padding:16px;background:#fff;font:14px system-ui">
${[375, 834].map((w) => `<h3 style="margin:8px 0">${w}px: without scrim (left) vs with scrim (right)</h3><div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px">${["before", "after"].map((v) => `<figure style="margin:0"><img style="display:block;width:${w === 375 ? 300 : 620}px;border:1px solid #ddd" src="${img(`${outDir}/${v}-${w}.png`)}"><figcaption>${v === "before" ? "Before (no scrim)" : "After (gradient.image-scrim)"}</figcaption></figure>`).join("")}</div>`).join("")}</body>`);
await sheet.screenshot({ path: `${outDir}/compare.png`, fullPage: true });
console.log(`${outDir}/compare.png`);
await browser.close();
