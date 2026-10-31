// Genera summary.md, las capturas lado a lado y los extractos del validador a partir de results.json.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { repoRoot, resultsDir } from "./common.mjs";
import { mcpCalls, sessionExcerpt } from "./excerpt.mjs";

const ORDER = ["r0", "a", "b", "c"];
const fmt = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(digits)) : String(v));
// Medida de una celda: mediana (mín–máx) para números, "k/n" para sí/no.
const cell = (m, key) => {
  const st = m?.stats?.[key];
  if (st) return `${fmt(st.median)} (${fmt(st.min)}–${fmt(st.max)})`;
  return fmt(m?.[key]);
};
const L = (r) => (r === "r0" ? "R0" : r.toUpperCase());

// Filas comunes a las dos tareas y filas propias de cada una: [etiqueta, clave] o [sección, null].
const SHARED_TOP = [
  ["Run quality", null],
  ["Agent finished within its budget", "agentFinished"],
  ["Figma tool calls", "figmaCalls"],
  ["Design-system MCP calls (batatabit-ds)", "batatabitCalls"],
  ["Guides / docs opened explicitly (AGENTS.md is auto-loaded)", "docsRead"],
  ["Project skill used (build-section-from-figma)", "skillUsed"],
  ["Permission denials", "permissionDenials"],
  ["Design-system validator, on the lines the agent added", null],
  ["Validator issues (total)", "issueCount"],
  ["…raw colour / spacing / font / radius / shadow values", "rawValueIssues"],
  ["…raw HTML where a catalog component exists", "rawHtmlIssues"],
  ["Components", null],
  ["Catalog components reused (distinct)", "componentsReused"],
  ["Catalog component uses", "componentUses"],
  ["Reuse ratio (uses / uses + raw HTML)", "reuseRatio"],
  ["New components created", "newComponents"],
  ["…with a guide", "newComponentsDocumented"],
  ["…whose guide passes docs:check", "newComponentsDocsPass"],
  ["Quality gates (only what is new against the starting state)", null],
  ["WCAG AA contrast failures (375 + 834)", "contrastFailures"],
  ["Focus-ring failures (375 + 834)", "focusRingFailures"],
  ["astro check errors", "astroErrors"],
  ["astro check warnings", "astroWarnings"],
  ["astro check hints", "astroHints"],
  ["Build succeeds", "buildOk"],
];
const FEATURE = {
  t1: [
    ["The FAQ", null],
    ["**FAQ opens and closes (headline)**", "interactive"],
    ["FAQ found on the page", "faqFound"],
    ["In the design's position (after the plans, before the footer)", "positionCorrect"],
    ["Questions present (of 4)", "questionsFound"],
    ["No horizontal overflow at 834px", "noOverflow834"],
    ["No horizontal overflow at 375px", "noOverflow375"],
    ["Visual difference vs Figma at 834px (0 = identical)", "visualDiff834"],
    ["Visual difference vs Figma at 375px (0 = identical)", "visualDiff375"],
  ],
  t2: [
    ["The testimonials section (the side-by-side screenshots are the headline)", null],
    ["Section found between the plans and the footer", "testimonialsFound"],
    ["Testimonials in it (target 3)", "testimonialItems"],
    ["No horizontal overflow at 834px", "noOverflow834"],
    ["No horizontal overflow at 375px", "noOverflow375"],
    ["Sanity check only: colours not used anywhere else on the page (834px)", "offPaletteColors"],
    ["Sanity check only: font families not used anywhere else on the page (834px)", "offFonts"],
  ],
};
const COST = [
  ["Cost", null],
  ["Duration (s)", "durationSec"],
  ["Tokens (input + output + cache)", "totalTokens"],
  ["Cost (USD, client-side estimate)", "costUsd"],
  ["Turns", "numTurns"],
];

const table = (data, task, rounds, rows) => {
  const lines = [`| Metric | ${rounds.map(L).join(" | ")} |`, `|---|${rounds.map(() => "---").join("|")}|`];
  for (const [label, key] of rows) {
    if (!key) { lines.push(`| **${label}** |${rounds.map(() => "").join("|")}|`); continue; }
    lines.push(`| ${label} | ${rounds.map((r) => cell(data.medians[task]?.[r], key)).join(" | ")} |`);
  }
  return lines;
};

export async function report(data) {
  const tasks = Object.keys(data.medians).sort();
  const allRounds = ORDER.filter((r) => tasks.some((t) => data.medians[t]?.[r]));
  const lines = [];
  lines.push("# Benchmark: R0 / A / B / C × two tasks", "");
  lines.push(`Model \`${data.model}\` · generated ${data.generatedAt.slice(0, 16).replace("T", " ")} UTC`, "");
  lines.push("## Rounds", "");
  for (const r of allRounds) lines.push(`- **${L(r)}** (\`${data.rounds[r].tag}\`, Figma: ${data.rounds[r].figma}): ${data.rounds[r].description}`);
  lines.push("", "## Tasks", "");
  for (const t of tasks) lines.push(`- **${t.toUpperCase()}**, ${data.tasks[t].title}${data.tasks[t].figma ? " (with the Figma link)" : " (no design, no Figma tools)"}.`);
  lines.push("", "Numbers are `median (min–max)` across the runs of each cell; yes/no checks show how many runs passed (for example `2/3`). `n` is the number of runs per cell.", "");

  // ---- matriz de un vistazo
  lines.push("## At a glance", "", `| | ${tasks.map((t) => `${t.toUpperCase()}: ${t === "t1" ? "FAQ opens · " : ""}validator issues · cost · duration`).join(" | ")} |`, `|---|${tasks.map(() => "---").join("|")}|`);
  for (const r of allRounds) lines.push(`| **${L(r)}** | ${tasks.map((t) => { const m = data.medians[t]?.[r]; return m ? `${t === "t1" ? `opens ${fmt(m.interactive)} · ` : ""}${cell(m, "issueCount")} issues · $${cell(m, "costUsd")} · ${cell(m, "durationSec")} s (n=${m.runs})` : "—"; }).join(" | ")} |`);
  lines.push("");

  for (const t of tasks) {
    const rounds = ORDER.filter((r) => data.medians[t]?.[r]);
    lines.push(`## ${t.toUpperCase()}: ${data.tasks[t].title}`, "");
    lines.push(...table(data, t, rounds, [...SHARED_TOP, ...FEATURE[t], ...COST]));
    const rules = [...new Set(rounds.flatMap((r) => Object.keys(data.medians[t][r].issuesByRule ?? {})))].sort();
    if (rules.length) {
      lines.push("", `### ${t.toUpperCase()}: validator issues by rule (median per run)`, "", `| Rule | ${rounds.map(L).join(" | ")} |`, `|---|${rounds.map(() => "---").join("|")}|`);
      for (const rule of rules) lines.push(`| ${rule} | ${rounds.map((r) => fmt(data.medians[t][r].issuesByRule?.[rule] ?? 0)).join(" | ")} |`);
    }
    lines.push("", `### ${t.toUpperCase()}: skills the agents loaded`, "");
    for (const r of rounds) lines.push(`- ${L(r)}: ${data.medians[t][r].skills.length ? data.medians[t][r].skills.map((s) => `\`${s}\``).join(", ") : "none"}`);
    lines.push("", `### ${t.toUpperCase()}: per run`, "", "| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | " + (t === "t1" ? "FAQ opens | FAQ found | Diff 834 | Diff 375" : "Found | Items | Off-palette colours") + " | Denials | Duration (s) | Cost (USD) |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|" + (t === "t1" ? "---|" : ""));
    for (const r of data.runs.filter((x) => x.task === t).sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.run - b.run)) {
      const feat = t === "t1" ? `${fmt(r.interactive)} | ${fmt(r.faqFound)} | ${fmt(r.visualDiff834)} | ${fmt(r.visualDiff375)}` : `${fmt(r.testimonialsFound)} | ${fmt(r.testimonialItems)} | ${fmt(r.offPaletteColors)}`;
      lines.push(`| ${r.id} | ${fmt(r.agentFinished)} | ${fmt(r.issueCount)} | ${fmt(r.componentsReused)} | ${fmt(r.rawHtmlIssues)} | ${fmt(r.newComponents)} | ${fmt(r.contrastFailures)} | ${fmt(r.astroErrors)} | ${feat} | ${fmt(r.permissionDenials)} | ${fmt(r.durationSec)} | ${fmt(r.costUsd)} |`);
    }
    lines.push("");
  }

  lines.push("## How to read this", "",
    "- **Validator issues** come from the same validator for every round (`mcp/src/validate-cli.ts`), run against the v7 catalog and tokens with the agent's changed files laid on top, and only the lines the agent added are counted. R0 has no tokens or components, so its raw colours, spacings, fonts and hand-made markup count the same way as anyone else's. A new component without a guide counts as `missing-docs`.",
    "- **Contrast, focus ring and `astro check`** count only what appears on top of the starting state of the round: the original port (R0) already has failures of its own.",
    "- **Visual difference** (T1) is the mean absolute difference between the FAQ crop of the page and the Figma crop, both reduced 4× in greyscale (R0 is compared with the original Figma, the others with the current one): it ranks runs, it is not a pixel-perfect score. The side-by-side images are the real comparison.",
    "- **Off-palette colours and fonts** (T2) are the colours and font families computed inside the new section that appear nowhere else on the page. It is a proxy for \"matches the rest of the page\", not a judgement of the design; the screenshots are.",
    "- **Cost and tokens** come from the headless run's own result event and are client-side estimates.",
    "- Every round has the same permissions (`bench/assets/claude-settings.json`, passed with `--settings`) and the same user-level plugins and skills; which skills each run loaded is listed per cell. Figma write tools are denied everywhere; T2 also denies every Figma tool.");
  writeFileSync(join(resultsDir, "summary.md"), lines.join("\n") + "\n");

  // ---- capturas: el run de cada celda más cercano a la mediana
  const shots = join(resultsDir, "screenshots");
  mkdirSync(shots, { recursive: true });
  // la ejecución mediana de la celda: se ordenan por problemas del validador y, a igualdad, por diferencia visual (T1) o coste (T2)
  const rep = (t, r) => {
    const rs = data.runs.filter((x) => x.task === t && x.round === r).sort((a, b) => (a.issueCount ?? 1e9) - (b.issueCount ?? 1e9) || (t === "t1" ? (a.visualDiff834 ?? 1e9) - (b.visualDiff834 ?? 1e9) : (a.costUsd ?? 1e9) - (b.costUsd ?? 1e9)));
    return rs[Math.floor(rs.length / 2)] ?? null;
  };
  const browser = await chromium.launch();
  try {
    for (const t of tasks) {
      for (const w of [834, 375]) {
        const panels = [];
        if (t === "t1") {
          const o = join(repoRoot, `bench/assets/figma-r0-faq-${w}.png`), c = join(repoRoot, `bench/assets/figma-faq-${w}.png`);
          copyFileSync(o, join(shots, `figma-original-faq-${w}.png`)); copyFileSync(c, join(shots, `figma-faq-${w}.png`));
          panels.push({ label: "Figma (original)", file: o, round: "r0" }, { label: "Figma (current)", file: c });
        }
        for (const r of ORDER.filter((x) => data.medians[t]?.[x])) {
          const run = rep(t, r);
          const name = t === "t1" ? `faq-${w}.png` : `region-${w}.png`;
          const src = run ? join(resultsDir, "raw", run.id, "screens", name) : null;
          if (src && existsSync(src)) { copyFileSync(src, join(shots, `${t}-${r}-${name}`)); panels.push({ label: `${L(r)} (${run.id})`, file: join(shots, `${t}-${r}-${name}`) }); }
          else panels.push({ label: `${L(r)} (${run?.id ?? "no run"})`, file: null });
        }
        // los paneles de T1 van: Figma original | R0 | Figma actual | A | B | C
        if (t === "t1") {
          const orderLabels = ["Figma (original)", "R0", "Figma (current)", "A", "B", "C"];
          const sorted = orderLabels.map((l) => panels.find((p) => p.label === l || p.label.startsWith(l + " "))).filter(Boolean);
          panels.length = 0; panels.push(...sorted);
        }
        const wpx = w === 834 ? 380 : 240;
        const page = await browser.newPage({ viewport: { width: 2400, height: 900 } });
        const cell = (p) => `<figure style="margin:0"><figcaption style="font:600 15px system-ui;margin:0 0 6px">${p.label}</figcaption>${p.file ? `<img style="display:block;width:${wpx}px;border:1px solid #ddd" src="data:image/png;base64,${readFileSync(p.file).toString("base64")}">` : `<div style="width:${wpx}px;height:150px;border:1px dashed #bbb;font:14px system-ui;color:#777;display:flex;align-items:center;justify-content:center">nothing rendered</div>`}</figure>`;
        await page.setContent(`<body style="margin:0;padding:16px;background:#fff"><div style="display:flex;gap:16px;align-items:flex-start">${panels.map(cell).join("")}</div></body>`);
        await page.locator("body > div").screenshot({ path: join(shots, `side-by-side-${t}-${w}.png`) });
        await page.close();
      }
    }
  } finally { await browser.close(); }

  // ---- una imagen limpia por tarea para diapositiva: R0 | A | B | C, con la ejecución mediana de cada ronda a 834 px
  const SUB = { r0: "no design system", a: "tokens + components", b: "+ AGENTS.md and guides", c: "+ MCP and skill" };
  const slideBrowser = await chromium.launch();
  try {
    for (const t of tasks) {
      const cols = ORDER.filter((r) => data.medians[t]?.[r]).map((r) => {
        const run = rep(t, r);
        const f = run ? join(resultsDir, "raw", run.id, "screens", t === "t1" ? "faq-834.png" : "region-834.png") : null;
        return { r, run, f: f && existsSync(f) ? f : null };
      });
      const page = await slideBrowser.newPage({ viewport: { width: 1920, height: 1080 } });
      const col = (c) => `<div style="flex:1;min-width:0"><div style="font:700 34px system-ui;color:#1b1b1b">${L(c.r)}</div><div style="font:400 20px system-ui;color:#666;margin:2px 0 14px">${SUB[c.r]}</div>${c.f ? `<img style="display:block;width:100%;border:1px solid #ddd" src="data:image/png;base64,${readFileSync(c.f).toString("base64")}">` : `<div style="height:200px;border:1px dashed #bbb"></div>`}</div>`;
      await page.setContent(`<body style="margin:0;background:#fff;width:1920px;height:1080px;box-sizing:border-box;padding:56px 48px"><div style="font:600 28px system-ui;color:#444;margin-bottom:28px">${data.tasks[t].title} · median run of each round, 834px</div><div style="display:flex;gap:28px;align-items:flex-start">${cols.map(col).join("")}</div></body>`);
      await page.screenshot({ path: join(shots, `slide-${t}.png`) });
      await page.close();
    }
  } finally { await slideBrowser.close(); }

  // ---- extracto de una ejecución de C donde el agente usa batatabit-ds y corrige algo (material para diapositiva)
  const exDir = join(resultsDir, "excerpts");
  mkdirSync(exDir, { recursive: true });
  const usage = ["# How round C used the design-system tools", "", "| Run | batatabit-ds calls by tool | Ran `npm run ds:validate` in Bash |", "|---|---|---|"];
  for (const t of tasks) {
    const cRuns = data.runs.filter((x) => x.task === t && x.round === "c");
    const scored = cRuns.map((x) => ({ id: x.id, calls: mcpCalls(x.id) }));
    for (const x of scored) usage.push(`| ${x.id} | ${Object.keys(x.calls).length ? Object.entries(x.calls).map(([k, v]) => `${k}×${v}`).join(", ") : "none"} | ${data.runs.find((r) => r.id === x.id)?.toolCalls?.Bash ? "see transcript" : "no"} |`);
    const best = [...scored].sort((a, b) => Object.values(b.calls).reduce((n, v) => n + v, 0) - Object.values(a.calls).reduce((n, v) => n + v, 0))[0];
    const hasMcp = best && Object.keys(best.calls).length > 0;
    const md = hasMcp
      ? sessionExcerpt(best.id, (e) => e.name.startsWith("mcp__batatabit-ds__"), `${t.toUpperCase()}: the agent uses the design-system MCP`)
      : cRuns.map((x) => sessionExcerpt(x.id, (e) => e.name === "Bash" && /ds:validate/.test(JSON.stringify(e.input)), `${t.toUpperCase()}: no C run called a batatabit-ds tool; this is the \`npm run ds:validate\` loop instead`)).find(Boolean);
    writeFileSync(join(exDir, hasMcp ? `c-${t}-mcp-session.md` : `c-${t}-ds-validate-session.md`), (hasMcp ? "" : "> None of the round C runs for this task called a `batatabit-ds` tool. The excerpt below is the same check run through the `ds:validate` npm script, which the agents preferred.\n\n") + (md ?? "No design-system validation call found in the C runs.\n") + "\n");
  }
  writeFileSync(join(exDir, "c-mcp-usage.md"), usage.join("\n") + "\n");

  // ---- peor extracto del validador por celda
  const ex = join(resultsDir, "excerpts");
  mkdirSync(ex, { recursive: true });
  for (const t of tasks) for (const r of ORDER.filter((x) => data.medians[t]?.[x])) {
    const rs = data.runs.filter((x) => x.task === t && x.round === r).sort((a, b) => (b.issueCount ?? 0) - (a.issueCount ?? 0));
    const worst = rs[0];
    const body = !worst || !worst.issueCount
      ? `${L(r)} ${t.toUpperCase()}: no validator issues in any run.\n`
      : [`${L(r)} ${t.toUpperCase()} · worst run ${worst.id} · ${worst.issueCount} validator issue(s)`, "", ...worst.issues.slice(0, 8).flatMap((i) => [`${i.file}:${i.line}:${i.column}  [${i.rule}]  ${i.message}  found: ${String(i.found).slice(0, 40)}`, `    fix: ${i.suggestion.slice(0, 150)}`]), ""].join("\n");
    writeFileSync(join(ex, `${t}-${r}.txt`), body);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = JSON.parse(readFileSync(join(resultsDir, "results.json"), "utf8"));
  await report(data);
  console.log("report regenerated from results.json");
}
