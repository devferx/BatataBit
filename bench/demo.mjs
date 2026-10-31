// Informe de la demo antes/después: lee los resultados del scorer (ronda `before` y `after`, tarea t3) y escribe
// demo/login/ con la tabla, las capturas lado a lado, los extractos de código y de la sesión del agente.
// Uso: BENCH_DIR=../BatataBit-demo BENCH_RESULTS=bench/demo-results node bench/demo.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { readManifest, repoRoot, resultsDir } from "./lib/common.mjs";
import { mcpCalls, sessionExcerpt } from "./lib/excerpt.mjs";

const BRANCH = { before: "feat/login-before-design-tokens", after: "feat/login" };
const out = join(repoRoot, "demo/login");
for (const d of ["screenshots", "excerpts", "transcripts"]) mkdirSync(join(out, d), { recursive: true });
const data = JSON.parse(readFileSync(join(resultsDir, "results.json"), "utf8"));
const manifest = readManifest();
const run = Object.fromEntries(["before", "after"].map((r) => [r, data.runs.find((x) => x.round === r && x.task === "t3")]));
const dirOf = (r) => manifest.find((m) => m.id === run[r].id).dir;
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));
const yn = (v) => (v === undefined || v === null ? "n/a" : v ? "yes" : "no");

// ---- transcripciones
for (const r of ["before", "after"]) copyFileSync(join(resultsDir, "raw", run[r].id, "transcript.jsonl"), join(out, "transcripts", `${r}.jsonl`));

// ---- tabla
const rules = [...new Set(["before", "after"].flatMap((r) => Object.keys(run[r].issuesByRule ?? {})))].sort();
const rows = [
  ["**Design-system validator** (lines the agent added, against the current catalog and tokens)"],
  ["Validator issues (total)", (r) => fmt(run[r].issueCount)],
  ...rules.map((rule) => [`…${rule}`, (r) => fmt(run[r].issuesByRule?.[rule] ?? 0)]),
  ["Raw colour, spacing, font, radius and shadow values", (r) => fmt(run[r].rawValueIssues)],
  ["**Components**"],
  ["Catalog components reused", (r) => `${fmt(run[r].componentsReused)} (${Object.entries(run[r].componentsUsed ?? {}).map(([k, v]) => `${k}×${v}`).join(", ") || "none"})`],
  ["Hand-made markup where a catalog component exists", (r) => fmt(run[r].rawHtmlIssues)],
  ["New components created", (r) => `${fmt(run[r].newComponents)}${run[r].newComponentNames?.length ? ` (${run[r].newComponentNames.join(", ")})` : ""}`],
  ["…with a guide that passes `docs:check`", (r) => `${fmt(run[r].newComponentsDocsPass)} of ${fmt(run[r].newComponents)}`],
  ["**Accessibility and quality** (rendered /login)"],
  ["New WCAG AA contrast failures (375 + 834)", (r) => fmt(run[r].contrastFailures)],
  ["Focus-visibility failures on /login (375 + 834)", (r) => fmt(run[r].focusRingFailures)],
  ["Every input has a label (programmatic)", (r) => yn(run[r].labelsOk)],
  ["…and the label is visible", (r) => yn(run[r].visibleLabelsOk)],
  ["Email input has `type=\"email\"`", (r) => yn(run[r].emailTypeOk)],
  ["Email `autocomplete` is `email` or `username`", (r) => yn(run[r].emailAutocompleteOk)],
  ["Password `autocomplete=\"current-password\"`", (r) => yn(run[r].passwordAutocompleteOk)],
  ["Submit is a real `<button type=\"submit\">` inside the form", (r) => yn(run[r].submitIsRealButton)],
  ["Submit label is exactly “Ingresar”", (r) => yn(run[r].submitLabelExact)],
  ["“¿Olvidaste tu contraseña?” is a link with an `href`", (r) => yn(run[r].forgotLinkOk)],
  ["Fields marked `required`", (r) => yn(run[r].requiredOk)],
  ["The heading is actually visible (not covered by another element)", (r) => yn(run[r].h1Unobstructed)],
  ["Fields, link and button are not covered by anything", (r) => yn(run[r].controlsUnobstructed)],
  ["`h1` count (should be 1)", (r) => fmt(run[r].h1Count)],
  ["Smallest tap target on the page, px (field, button, link)", (r) => fmt(run[r].minTargetHeight)],
  ["No horizontal overflow at 375px / 834px", (r) => `${yn(run[r].noOverflow375)} / ${yn(run[r].noOverflow834)}`],
  ["`astro check` errors (new)", (r) => fmt(run[r].astroErrors)],
  ["Build succeeds", (r) => yn(run[r].buildOk)],
  ["**The run**"],
  ["Duration (s)", (r) => fmt(run[r].durationSec)],
  ["Cost (USD, client-side estimate)", (r) => fmt(run[r].costUsd)],
  ["Turns", (r) => fmt(run[r].numTurns)],
  ["Permission denials", (r) => fmt(run[r].permissionDenials)],
  ["`batatabit-ds` MCP calls", (r) => fmt(run[r].batatabitCalls)],
  ["Skills loaded", (r) => (run[r].skillsLoaded?.length ? run[r].skillsLoaded.map((s) => `\`${s}\``).join(", ") : "none")],
  ["Files changed or added", (r) => run[r].changedFiles.map((f) => `\`${f}\``).join(", ")],
];
const lines = [
  "# Login page: before and after the design system", "",
  "The same one-shot request, the same model (`claude-sonnet-5-5`) and the same permissions, in two independent one-commit clones. Figma tools are denied in both: the login is not in Figma.", "",
  "> Create a login page at /login with email and password fields, a \"¿Olvidaste tu contraseña?\" link, and a submit button labeled \"Ingresar\". It must match the rest of the site and work on mobile and tablet.", "",
  `- **Before** (\`${BRANCH.before}\`): tag \`v1-astro-parity\`. Astro with one global CSS: no tokens, no components, no docs, no AGENTS.md, no MCP, no skill.`,
  `- **After** (\`${BRANCH.after}\`): current \`main\`. Tokens, seven components with guides, AGENTS.md, the \`batatabit-ds\` MCP server and the \`build-section-from-figma\` skill (\`bench/\`, \`AUDIT.md\` and \`PHASE5-PROPOSAL.md\` removed so no process notes leak).`, "",
  "One run per side, so this is an illustration, not a statistic.", "",
  `| Metric | Before (\`${BRANCH.before}\`) | After (\`${BRANCH.after}\`) |`, "|---|---|---|",
];
for (const [label, f] of rows) lines.push(f ? `| ${label} | ${f("before")} | ${f("after")} |` : `| ${label} |||`);
lines.push("", "## How it was measured", "",
  "- The validator (`mcp/src/validate-cli.ts`) runs against the catalog and tokens of the current `main` with the agent's files laid on top, and counts only issues on lines the agent added. The \"before\" project has no tokens, so every raw value there counts against it.",
  "- New contrast failures are the ones that did not exist on the starting site's home page; focus-visibility failures are counted on `/login` itself.",
  "- Accessibility checks run in a real browser on the built page (`bench/lib/render.mjs`).",
  "- Screenshots: `screenshots/`. Code excerpts: `excerpts/`. Full transcripts: `transcripts/`. Raw scorer output: `results.json`.");
writeFileSync(join(out, "summary.md"), lines.join("\n") + "\n");
copyFileSync(join(resultsDir, "results.json"), join(out, "results.json"));

// ---- capturas lado a lado, tamaño diapositiva 1920×1080
const browser = await chromium.launch();
try {
  for (const w of [375, 834]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const img = (r) => { const f = join(resultsDir, "raw", run[r].id, "screens", `full-${w}.png`); return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString("base64")}` : ""; };
    const col = (r, label, sub) => `<div style="flex:1;min-width:0;text-align:center"><div style="font:700 36px system-ui;color:#1b1b1b">${label}</div><div style="font:400 20px system-ui;color:#666;margin:2px 0 16px">${sub}</div><img style="height:${w === 375 ? 820 : 760}px;max-width:100%;object-fit:contain;object-position:top;border:1px solid #ddd" src="${img(r)}"></div>`;
    await page.setContent(`<body style="margin:0;background:#fff;width:1920px;height:1080px;box-sizing:border-box;padding:44px 64px"><div style="font:600 26px system-ui;color:#444;margin-bottom:22px">/login at ${w}px · same request, one run each</div><div style="display:flex;gap:56px;align-items:flex-start;justify-content:center">${col("before", "Before", "no design system")}${col("after", "After", "tokens, components, docs, MCP, skill")}</div></body>`);
    await page.screenshot({ path: join(out, "screenshots", `side-by-side-${w}.png`) });
    await page.close();
  }
} finally { await browser.close(); }

// ---- extractos de código: una zona corta de cada versión que muestre la diferencia
const window_ = (file, center, before = 3, after = 11) => {
  const L = readFileSync(file, "utf8").split("\n");
  const from = Math.max(0, center - before), to = Math.min(L.length, center + after);
  return { from: from + 1, to, text: L.slice(from, to).join("\n") };
};
function excerptFor(r) {
  const dir = dirOf(r);
  const rec = run[r];
  const files = rec.changedFiles.filter((f) => /\.(astro|css)$/.test(f));
  if (r === "before") {
    const issue = (rec.issues ?? []).find((i) => /raw-color|raw-spacing|raw-font/.test(i.rule)) ?? rec.issues?.[0];
    if (issue) { const w = window_(join(dir, issue.file), issue.line - 1); return { file: issue.file, ...w, note: `First of ${rec.issueCount} validator issues: ${issue.rule} at line ${issue.line}.` }; }
  } else {
    const used = Object.keys(rec.componentsUsed ?? {});
    for (const f of files.filter((x) => x.endsWith(".astro"))) {
      const L = readFileSync(join(dir, f), "utf8").split("\n");
      const form = L.findIndex((l) => /<form[\s>]/.test(l)), end = L.findIndex((l, i) => i > form && /<\/form>/.test(l));
      if (form >= 0 && end > form) return { file: f, ...window_(join(dir, f), form, 0, Math.min(end - form + 1, 24)), note: `The form is built from catalog components (${used.join(", ")}) and the new TextField; no values of its own.` };
      const idx = L.findIndex((l) => used.some((n) => new RegExp(`<${n}[\\s/>]`).test(l)));
      if (idx >= 0) return { file: f, ...window_(join(dir, f), idx, 4, 13), note: `Uses ${used.join(", ")} from the catalog.` };
    }
  }
  const f = files[0];
  return f ? { file: f, ...window_(join(dir, f), 0, 0, 16), note: "Start of the main file." } : null;
}
for (const r of ["before", "after"]) {
  const e = excerptFor(r);
  const lang = e?.file.endsWith(".css") ? "css" : "astro";
  writeFileSync(join(out, "excerpts", `code-${r}.md`), e ? `# ${r === "before" ? "Before" : "After"}: \`${e.file}\` lines ${e.from}–${e.to}\n\n${e.note}\n\n\`\`\`${lang}\n${e.text}\n\`\`\`\n` : "No code excerpt available.\n");
}

// ---- sesión del agente "after" con las herramientas de batatabit-ds
const calls = mcpCalls(run.after.id);
const used = Object.keys(calls).length > 0;
const md = used
  ? sessionExcerpt(run.after.id, (e) => e.name.startsWith("mcp__batatabit-ds__"), "After: the agent uses the design-system MCP")
  : sessionExcerpt(run.after.id, (e) => e.name === "Bash" && /ds:validate|docs:check/.test(JSON.stringify(e.input)), "After: the agent did not call batatabit-ds tools; this is its design-system check through the npm scripts");
writeFileSync(join(out, "excerpts", used ? "after-mcp-session.md" : "after-validate-session.md"), (used ? "" : "> The \"after\" agent made no `batatabit-ds` MCP call (calls: none). The excerpt shows the same kind of check run through `npm run ds:validate` / `docs:check`.\n\n") + (md ?? "No design-system check found in the transcript.\n") + "\n");
console.log(JSON.stringify({ mcpCalls: calls, out }, null, 2));
