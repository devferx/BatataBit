// Captura screenshots full-page a 375px y 1024px.
// Uso: node tests/visual/capture.mjs <url> <carpeta-salida> [anchos separados por coma; por defecto 375,1024]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [url, outDir, widthsArg] = process.argv.slice(2);
const widths = (widthsArg ?? "375,1024").split(",").map(Number);
if (!url || !outDir) {
  console.error("Uso: node tests/visual/capture.mjs <url> <carpeta-salida>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${outDir}/${width}.png`, fullPage: true });
  console.log(`${outDir}/${width}.png`);
  await context.close();
}
await browser.close();
