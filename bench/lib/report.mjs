// Genera summary.md, las capturas lado a lado y los extractos del validador a partir de results.json.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { repoRoot, resultsDir } from "./common.mjs";

const fmt = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(digits)) : String(v));

const ROWS = [
  ["Run quality", null],
  ["Agent finished within its budget", "agentFinished", "rate"],
  ["Figma MCP available in the session", "figmaAvailable", "rate"],
  ["Figma tool calls", "figmaCalls"],
  ["Design-system MCP calls (batatabit-ds)", "batatabitCalls"],
  ["…of which validate_file", "validateFileCalls"],
  ["Guides / docs opened explicitly (AGENTS.md is auto-loaded)", "docsRead"],
  ["Project skill used (build-section-from-figma)", "skillUsed", "rate"],
  ["Design-system validator issues on changed files", null],
  ["Validator issues (total)", "issueCount"],
  ["Components", null],
  ["Catalog components reused (distinct)", "componentsReused"],
  ["Catalog component uses", "componentUses"],
  ["Raw HTML where a component exists", "rawHtmlIssues"],
  ["Reuse ratio (uses / uses + raw HTML)", "reuseRatio"],
  ["New components created", "newComponents"],
  ["…with a guide", "newComponentsDocumented"],
  ["…whose guide passes docs:check", "newComponentsDocsPass"],
  ["Quality gates", null],
  ["WCAG AA contrast failures (375 + 834)", "contrastFailures"],
  ["Focus-ring failures (375 + 834)", "focusRingFailures"],
  ["astro check errors", "astroErrors"],
  ["astro check warnings", "astroWarnings"],
  ["astro check hints", "astroHints"],
  ["Build succeeds", "buildOk", "rate"],
  ["The feature", null],
  ["FAQ found on the page", "faqFound", "rate"],
  ["In the design's position (after the plans, before the footer)", "positionCorrect", "rate"],
  ["Questions present (of 4)", "questionsFound"],
  ["A question opens and closes", "interactive", "rate"],
  ["No horizontal overflow at 834px", "noOverflow834", "rate"],
  ["No horizontal overflow at 375px", "noOverflow375", "rate"],
  ["Visual difference vs Figma at 834px (0 = identical)", "visualDiff834"],
  ["Visual difference vs Figma at 375px (0 = identical)", "visualDiff375"],
  ["Cost", null],
  ["Duration (s)", "durationSec"],
  ["Tokens (input + output + cache)", "totalTokens"],
  ["Cost (USD, client-side estimate)", "costUsd"],
  ["Turns", "numTurns"],
];

export async function report(data) {
  const rounds = Object.keys(data.medians).sort();
  const L = (r) => r.toUpperCase();
  const lines = [];
  lines.push("# Benchmark: implement the FAQ section from Figma", "");
  lines.push(`Base: tag \`${data.tag}\` · model \`${data.model}\` · generated ${data.generatedAt.slice(0, 16).replace("T", " ")} UTC`, "");
  lines.push("Task (identical in every run): *Implement the FAQ section from the Figma \"Tablet ≥768\" frame and add it to the landing page in the position it has in the design. It must work on mobile and tablet.*", "");
  for (const r of rounds) lines.push(`- **Round ${L(r)}** (${data.medians[r].runs} run${data.medians[r].runs === 1 ? "" : "s"}): ${data.rounds[r]}`);
  lines.push("", "Values are the **median** across runs of each round; yes/no checks show how many runs passed (for example `2/3`).", "");
  lines.push(`| Metric | ${rounds.map(L).join(" | ")} |`, `|---|${rounds.map(() => "---").join("|")}|`);
  for (const [label, key, kind] of ROWS) {
    if (!key) { lines.push(`| **${label}** |${rounds.map(() => "").join("|")}|`); continue; }
    lines.push(`| ${label} | ${rounds.map((r) => (kind === "rate" ? fmt(data.medians[r][key]) : fmt(data.medians[r][key]))).join(" | ")} |`);
  }
  const rules = [...new Set(rounds.flatMap((r) => Object.keys(data.medians[r].issuesByRule ?? {})))].sort();
  if (rules.length) {
    lines.push("", "### Validator issues by rule (median per run)", "", `| Rule | ${rounds.map(L).join(" | ")} |`, `|---|${rounds.map(() => "---").join("|")}|`);
    for (const rule of rules) lines.push(`| ${rule} | ${rounds.map((r) => fmt(data.medians[r].issuesByRule?.[rule] ?? 0)).join(" | ")} |`);
  }
  lines.push("", "### Per run", "", "| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | FAQ found | Diff 834 | Diff 375 | Duration (s) | Cost (USD) |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of data.runs) lines.push(`| ${r.id} | ${fmt(r.agentFinished)} | ${fmt(r.issueCount)} | ${fmt(r.componentsReused)} | ${fmt(r.rawHtmlIssues)} | ${fmt(r.newComponents)} | ${fmt(r.contrastFailures)} | ${fmt(r.astroErrors)} | ${fmt(r.faqFound)} | ${fmt(r.visualDiff834)} | ${fmt(r.visualDiff375)} | ${fmt(r.durationSec)} | ${fmt(r.costUsd)} |`);
  lines.push("", "### How to read this", "",
    "- **Validator issues** are counted by the same validator for every round (`mcp/src/validate-cli.ts`), on the files the agent changed or created, against the tokens and component list of that run. A new component without a guide always counts as `missing-docs`, so round A, which has no guides to imitate, starts with that handicap by design.",
    "- **Visual difference** is the mean absolute difference between the FAQ crop of the page and the Figma crop, both reduced 4× in greyscale: it ranks runs, it is not a pixel-perfect score. The side-by-side images are the real comparison.",
    "- **Cost and tokens** come from the headless run's own result event and are client-side estimates.",
    "- Every round also has the user-level plugins and skills of the machine (for example Figma's own design-to-code skill); they are identical across rounds.");
  writeFileSync(join(resultsDir, "summary.md"), lines.join("\n") + "\n");

  // ---- representante de cada ronda: la ejecución con diferencia visual más cercana a la mediana
  const rep = {};
  for (const r of rounds) {
    const rs = data.runs.filter((x) => x.round === r);
    const target = data.medians[r].visualDiff834;
    rep[r] = [...rs].sort((a, b) => Math.abs((a.visualDiff834 ?? 1e9) - (target ?? 0)) - Math.abs((b.visualDiff834 ?? 1e9) - (target ?? 0)))[0] ?? null;
  }
  const shots = join(resultsDir, "screenshots");
  mkdirSync(shots, { recursive: true });
  const panels = { 834: [{ label: "Figma", file: join(repoRoot, "bench/assets/figma-faq-834.png") }], 375: [{ label: "Figma", file: join(repoRoot, "bench/assets/figma-faq-375.png") }] };
  copyFileSync(join(repoRoot, "bench/assets/figma-faq-834.png"), join(shots, "figma-faq-834.png"));
  copyFileSync(join(repoRoot, "bench/assets/figma-faq-375.png"), join(shots, "figma-faq-375.png"));
  for (const r of rounds) for (const w of [834, 375]) {
    const src = rep[r] ? join(resultsDir, "raw", rep[r].id, "screens", `faq-${w}.png`) : null;
    if (src && existsSync(src)) { copyFileSync(src, join(shots, `${r}-faq-${w}.png`)); panels[w].push({ label: `Round ${L(r)} (${rep[r].id})`, file: join(shots, `${r}-faq-${w}.png`) }); }
    else panels[w].push({ label: `Round ${L(r)}`, file: null });
  }
  const browser = await chromium.launch();
  try {
    for (const w of [834, 375]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      const cell = (p) => `<figure style="margin:0"><figcaption style="font:600 15px system-ui;margin:0 0 6px">${p.label}</figcaption>${p.file ? `<img style="display:block;width:${w === 834 ? 380 : 240}px;border:1px solid #ddd" src="data:image/png;base64,${readFileSync(p.file).toString("base64")}">` : `<div style="width:${w === 834 ? 380 : 240}px;height:150px;border:1px dashed #bbb;font:14px system-ui;color:#777;display:flex;align-items:center;justify-content:center">no FAQ rendered</div>`}</figure>`;
      await page.setContent(`<body style="margin:0;padding:16px;background:#fff"><div style="display:flex;gap:16px;align-items:flex-start">${panels[w].map(cell).join("")}</div></body>`);
      await page.locator("body > div").screenshot({ path: join(shots, `side-by-side-${w}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }

  // ---- peor extracto del validador por ronda
  const ex = join(resultsDir, "excerpts");
  mkdirSync(ex, { recursive: true });
  for (const r of rounds) {
    const rs = data.runs.filter((x) => x.round === r).sort((a, b) => (b.issueCount ?? 0) - (a.issueCount ?? 0));
    const worst = rs[0];
    const body = !worst || !worst.issueCount
      ? `Round ${L(r)}: no validator issues in any run.\n`
      : [`Round ${L(r)} · worst run ${worst.id} · ${worst.issueCount} validator issue(s)`, "", ...worst.issues.slice(0, 8).flatMap((i) => [`${i.file}:${i.line}:${i.column}  [${i.rule}]  ${i.message}  found: ${String(i.found).slice(0, 40)}`, `    fix: ${i.suggestion.slice(0, 150)}`]), ""].join("\n");
    writeFileSync(join(ex, `round-${r}.txt`), body);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = JSON.parse(readFileSync(join(resultsDir, "results.json"), "utf8"));
  await report(data);
  console.log("report regenerated from results.json");
}
