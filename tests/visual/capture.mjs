// Captura screenshots full-page a 375px y 1024px.
// Uso: node tests/visual/capture.mjs <url> <carpeta-salida>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) {
  console.error("Uso: node tests/visual/capture.mjs <url> <carpeta-salida>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of [375, 1024]) {
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
