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

// Tarjetas de plan: PlanCard en v7, `.plans-container--card` en el original (v1).
const PLAN_CARD_SELECTOR = ".plan-card, .plans-container--card";

/**
 * Inspecciona la página a un ancho y hace capturas.
 * Tarea t1 (FAQ): localiza la FAQ, comprueba posición, preguntas, interacción y desbordes, y recorta la captura.
 * Tarea t2 (testimonios): localiza lo que el agente añadió entre los planes y el footer, cuenta los testimonios,
 * mide si usa colores y tipografías que ya existen en el resto de la página y recorta la sección.
 */
export async function inspect(url, width, { task = "t1", fullPath, faqCrop, regionPath }) {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" })).newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const info = task === "t1" ? await inspectFaq(page) : await inspectTestimonials(page);

    // interacción (solo FAQ): abrir la primera pregunta
    let toggleWorks = false;
    if (task === "t1" && info.headingFound) {
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
    if (task === "t1" && info.headingFound) {
      const y = Math.max(0, Math.round(info.headingTop - faqCrop.headingTopInCrop));
      faqPath = faqCrop.out;
      await page.screenshot({ path: faqPath, fullPage: true, clip: { x: 0, y, width, height: faqCrop.height } });
    }
    let outPath = null;
    if (task === "t2" && info.regionFound && info.regionBox) {
      const b = info.regionBox;
      const y = Math.max(0, Math.round(b.top - 24));
      outPath = regionPath;
      await page.screenshot({ path: outPath, fullPage: true, clip: { x: 0, y, width, height: Math.min(1600, Math.round(b.height + 48)) } });
    }
    return { ...info, toggleWorks, overflow: info.scrollWidth > info.innerWidth || overflowAfter, faqPath, regionPath: outPath };
  } finally {
    await browser.close();
  }
}

function inspectFaq(page) {
  return page.evaluate((args) => {
    const { questions, cardSelector } = args;
    const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(/batatabit/g, "batabit");   // el original escribe "Batabit"
    const startsFaq = (e) => /^¿?preguntas\b/.test(norm(e.textContent ?? ""));
    // el elemento más pequeño (por longitud de texto) cuyo texto empieza por "¿Preguntas?": el titular
    const heading = [...document.querySelectorAll("body *")].filter(startsFaq).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] ?? null;
    const body = norm(document.body.innerText);
    const out = { headingFound: !!heading, headingTag: heading?.tagName ?? null, questionsFound: questions.filter((q) => body.includes(norm(q))).length, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
    if (heading) {
      out.headingTop = heading.getBoundingClientRect().top + window.scrollY;
      const cards = [...document.querySelectorAll(cardSelector)];
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
  }, { questions: QUESTIONS, cardSelector: PLAN_CARD_SELECTOR });
}

function inspectTestimonials(page) {
  return page.evaluate((cardSelector) => {
    const cards = [...document.querySelectorAll(cardSelector)];
    const lastCard = cards[cards.length - 1];
    const footer = document.querySelector("footer");
    const out = { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, regionFound: false, positionCorrect: false };
    if (!lastCard || !footer) return out;
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    // lo que el agente puso entre la última tarjeta de plan y el footer (sus elementos de nivel superior)
    const between = [...document.querySelectorAll("body *")].filter((e) => (lastCard.compareDocumentPosition(e) & FOLLOWING) && !lastCard.contains(e) && (e.compareDocumentPosition(footer) & FOLLOWING) && !e.contains(footer) && e !== footer);
    const set = new Set(between);
    const top = between.filter((e) => !set.has(e.parentElement) && !/^(SCRIPT|STYLE)$/.test(e.tagName));
    const visible = top.filter((e) => e.getBoundingClientRect().height > 0 && (e.innerText ?? "").trim().length > 0);
    if (!visible.length) return out;
    const text = visible.map((e) => e.innerText).join("\n");
    const rects = visible.map((e) => e.getBoundingClientRect());
    const topY = Math.min(...rects.map((r) => r.top)) + window.scrollY, bottomY = Math.max(...rects.map((r) => r.bottom)) + window.scrollY;
    out.regionFound = text.trim().length > 30;
    out.positionCorrect = out.regionFound;   // por construcción: después de los planes y antes del footer
    out.regionBox = { top: topY, height: bottomY - topY };
    out.mentionsTestimonials = /testimon|opini[oó]n|clientes|dicen|cuentan|historias|rese[ñn]/i.test(text);
    // número de testimonios: <blockquote>, o el mayor grupo de hermanos repetidos con texto
    const all = visible.flatMap((e) => [e, ...e.querySelectorAll("*")]);
    const quotes = all.filter((e) => e.tagName === "BLOCKQUOTE").length;
    let items = quotes;
    if (!items) {
      const groups = new Map();
      for (const e of all) for (const c of e.children) {
        if ((c.innerText ?? "").trim().length < 30) continue;
        const key = `${all.indexOf(e)}|${c.tagName}|${c.className}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      items = Math.max(0, ...[...groups.values()].filter((n) => n >= 2 && n <= 10));
    }
    out.items = items;
    // ¿se parece al resto de la página? colores y tipografías que ya existen fuera de la sección
    const inRegion = (e) => visible.some((r) => r.contains(e));
    const colorsOf = (e) => {
      const cs = getComputedStyle(e), found = [];
      const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,\/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
      if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) found.push(cs.color);
      if (alpha(cs.backgroundColor) > 0) found.push(cs.backgroundColor);
      if (parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0) found.push(cs.borderTopColor);
      return found;
    };
    const fontOf = (e) => ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ? [getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim()] : []);
    const rest = [...document.querySelectorAll("body *")].filter((e) => !inRegion(e));
    const restColors = new Set(rest.flatMap(colorsOf)), restFonts = new Set(rest.flatMap(fontOf));
    const regionEls = all;
    const regionColors = [...new Set(regionEls.flatMap(colorsOf))], regionFonts = [...new Set(regionEls.flatMap(fontOf))];
    out.regionColors = regionColors; out.regionFonts = regionFonts;
    out.offPaletteColors = regionColors.filter((c) => !restColors.has(c)).length;
    out.offFonts = regionFonts.filter((f) => !restFonts.has(f)).length;
    return out;
  }, PLAN_CARD_SELECTOR);
}
