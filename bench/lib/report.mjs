// Genera summary.md, las capturas lado a lado y los extractos del validador a partir de results.json.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { repoRoot, resultsDir } from "./common.mjs";

const ORDER = ["r0", "a", "b", "c"];
const fmt = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(digits)) : String(v));
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
    ["FAQ found on the page", "faqFound"],
    ["In the design's position (after the plans, before the footer)", "positionCorrect"],
    ["Questions present (of 4)", "questionsFound"],
    ["A question opens and closes", "interactive"],
    ["No horizontal overflow at 834px", "noOverflow834"],
    ["No horizontal overflow at 375px", "noOverflow375"],
    ["Visual difference vs Figma at 834px (0 = identical)", "visualDiff834"],
    ["Visual difference vs Figma at 375px (0 = identical)", "visualDiff375"],
  ],
  t2: [
    ["The testimonials section", null],
    ["Section found between the plans and the footer", "testimonialsFound"],
    ["Testimonials in it (target 3)", "testimonialItems"],
    ["No horizontal overflow at 834px", "noOverflow834"],
    ["No horizontal overflow at 375px", "noOverflow375"],
    ["Colours not used anywhere else on the page (834px)", "offPaletteColors"],
    ["Font families not used anywhere else on the page (834px)", "offFonts"],
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
    lines.push(`| ${label} | ${rounds.map((r) => fmt(data.medians[task]?.[r]?.[key])).join(" | ")} |`);
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
  lines.push("", "Values are the **median** across the runs of each cell; yes/no checks show how many runs passed (for example `2/3`). `n` is the number of runs per cell.", "");

  // ---- matriz de un vistazo
  lines.push("## At a glance", "", `| | ${tasks.map((t) => `${t.toUpperCase()}: validator issues · cost · duration`).join(" | ")} |`, `|---|${tasks.map(() => "---").join("|")}|`);
  for (const r of allRounds) lines.push(`| **${L(r)}** | ${tasks.map((t) => { const m = data.medians[t]?.[r]; return m ? `${fmt(m.issueCount)} issues · $${fmt(m.costUsd)} · ${fmt(m.durationSec)} s (n=${m.runs})` : "—"; }).join(" | ")} |`);
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
    lines.push("", `### ${t.toUpperCase()}: per run`, "", "| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | " + (t === "t1" ? "FAQ found | Diff 834 | Diff 375" : "Found | Items | Off-palette colours") + " | Denials | Duration (s) | Cost (USD) |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of data.runs.filter((x) => x.task === t).sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.run - b.run)) {
      const feat = t === "t1" ? `${fmt(r.faqFound)} | ${fmt(r.visualDiff834)} | ${fmt(r.visualDiff375)}` : `${fmt(r.testimonialsFound)} | ${fmt(r.testimonialItems)} | ${fmt(r.offPaletteColors)}`;
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
  const rep = (t, r) => {
    const rs = data.runs.filter((x) => x.task === t && x.round === r);
    const key = t === "t1" ? "visualDiff834" : "issueCount";
    const target = data.medians[t]?.[r]?.[key];
    return [...rs].sort((a, b) => Math.abs((a[key] ?? 1e9) - (target ?? 0)) - Math.abs((b[key] ?? 1e9) - (target ?? 0)))[0] ?? null;
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
