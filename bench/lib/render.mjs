// Servidor estático para `dist/` e inspección de la página con Playwright.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain" };

export function serveDist(dist, port) {
  const server = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(dist, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

export const QUESTIONS = [
  "Batatabit me permite hacer compras en su plataforma?",
  "Qué es Bitcoin?",
  "Cómo puedo realizar una transacción en bitcoins?",
  "Cómo aseguro mis compras?",
];

/** Inspecciona la página a un ancho: localiza la FAQ, comprueba posición, desbordes e interacción, y hace capturas. */
export async function inspect(url, width, { fullPath, faqCrop }) {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" })).newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const info = await page.evaluate((questions) => {
      const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const startsFaq = (e) => /^¿?preguntas\b/.test(norm(e.textContent ?? ""));
      // el elemento más pequeño (por longitud de texto) cuyo texto empieza por "¿Preguntas?": el titular
      const heading = [...document.querySelectorAll("body *")].filter(startsFaq).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] ?? null;
      const body = norm(document.body.innerText);
      const out = { headingFound: !!heading, headingTag: heading?.tagName ?? null, questionsFound: questions.filter((q) => body.includes(norm(q))).length, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
      if (heading) {
        out.headingTop = heading.getBoundingClientRect().top + window.scrollY;
        const cards = [...document.querySelectorAll(".plan-card")];
        const lastCard = cards[cards.length - 1];
        const footer = document.querySelector("footer");
        const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
        // posición del diseño: después de las tarjetas de planes y antes del footer
        out.positionCorrect = !!(lastCard && footer && (lastCard.compareDocumentPosition(heading) & FOLLOWING) && (heading.compareDocumentPosition(footer) & FOLLOWING) && !heading.contains(footer) && !footer.contains(heading));
        const scope = heading.closest("section") ?? document.body;
        out.details = scope.querySelectorAll("details").length;
        out.ariaExpanded = scope.querySelectorAll("[aria-expanded]").length;
      }
      return out;
    }, QUESTIONS);

    // interacción: abrir la primera pregunta
    let toggleWorks = false;
    if (info.headingFound) {
      toggleWorks = await page.evaluate(async () => {
        const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
        const trigger = [...document.querySelectorAll("summary, button[aria-expanded], [role=button][aria-expanded]")].find((e) => /bitcoin|compras|transacci/i.test(norm(e.textContent ?? "")) || e.closest("details, section")?.textContent?.match(/preguntas/i));
        if (!trigger) return false;
        const state = () => (trigger.tagName === "SUMMARY" ? String(trigger.parentElement.open) : trigger.getAttribute("aria-expanded"));
        const before = state();
        trigger.click();
        await new Promise((r) => setTimeout(r, 150));
        return state() !== before;
      });
    }
    // la apertura no debe dejar la página desbordada
    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    // recargar para capturar en estado inicial
    await page.reload({ waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fullPath, fullPage: true });
    let faqPath = null;
    if (info.headingFound) {
      const y = Math.max(0, Math.round(info.headingTop - faqCrop.headingTopInCrop));
      faqPath = faqCrop.out;
      await page.screenshot({ path: faqPath, fullPage: true, clip: { x: 0, y, width, height: faqCrop.height } });
    }
    return { ...info, toggleWorks, overflow: info.scrollWidth > info.innerWidth || overflowAfter, faqPath };
  } finally {
    await browser.close();
  }
}
