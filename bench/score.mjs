// Puntúa cada run con el mismo código para todas las rondas y escribe bench/results/.
// Mide solo lo que el agente cambió o creó. Usa los validadores y scripts del árbol principal, no los del run.
// Uso: node bench/score.mjs [--rounds a,b,c] [--ids a-1] [--no-render]
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { config, git, median, parseArgs, readManifest, repoRoot, resultsDir } from "./lib/common.mjs";
import { crop as cropPng, readPng, visualDifference } from "./lib/images.mjs";
import { inspect, serveDist } from "./lib/render.mjs";
import { report } from "./lib/report.mjs";

const args = parseArgs(process.argv.slice(2));
const wantedRounds = args.rounds ? String(args.rounds).split(",") : null;
const wantedIds = args.ids ? String(args.ids).split(",") : null;
const ref = JSON.parse(readFileSync(join(repoRoot, "bench/assets/figma-reference.json"), "utf8"));
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const sh = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts }); return { status: r.status, out: strip((r.stdout ?? "") + (r.stderr ?? "")), stdout: r.stdout ?? "" }; };
const PORT = 4700;

// Versión asíncrona: el servidor estático vive en este mismo proceso, así que no se puede bloquear con spawnSync.
const shAsync = (cmd, a, opts = {}) => new Promise((resolve) => {
  const child = spawn(cmd, a, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  child.on("close", (status) => resolve({ status, out: strip(out) }));
});

// ---------------------------------------------------------------------------------------------
function readTranscript(id) {
  const file = join(resultsDir, "raw", id, "transcript.jsonl");
  if (!existsSync(file)) return null;
  const events = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") ?? null;
  const result = [...events].reverse().find((e) => e.type === "result") ?? null;
  const tools = {};
  const reads = [];
  const skills = [];
  for (const e of events) {
    if (e.type !== "assistant") continue;
    for (const c of e.message?.content ?? []) {
      if (c.type !== "tool_use") continue;
      tools[c.name] = (tools[c.name] ?? 0) + 1;
      if (c.name === "Skill" && c.input?.skill) skills.push(c.input.skill);
      if (c.name === "Read" && c.input?.file_path) reads.push(c.input.file_path);
    }
  }
  return { init, result, tools, reads, skills };
}

const sumBy = (tools, re) => Object.entries(tools).filter(([k]) => re.test(k)).reduce((n, [, v]) => n + v, 0);

// ---------------------------------------------------------------------------------------------
async function scoreRun(run, port) {
  const dir = run.dir;
  const rec = { id: run.id, round: run.round, run: run.run, scoredAt: new Date().toISOString() };
  const meta = existsSync(join(resultsDir, "raw", run.id, "meta.json")) ? JSON.parse(readFileSync(join(resultsDir, "raw", run.id, "meta.json"), "utf8")) : null;
  const tr = readTranscript(run.id);
  rec.ran = !!tr?.result;

  // ---- uso, duración y herramientas (de la transcripción)
  if (tr?.result) {
    const u = tr.result.usage ?? {};
    rec.durationSec = Math.round((tr.result.duration_ms ?? 0) / 1000);
    rec.apiSeconds = Math.round((tr.result.duration_api_ms ?? 0) / 1000);
    rec.costUsd = tr.result.total_cost_usd ?? null;
    rec.numTurns = tr.result.num_turns ?? null;
    rec.totalTokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    rec.outputTokens = u.output_tokens ?? null;
    rec.permissionDenials = (tr.result.permission_denials ?? []).length;
    rec.agentFinished = tr.result.subtype === "success" && !tr.result.is_error;
    rec.stopSubtype = tr.result.subtype;
  }
  rec.wallSeconds = meta?.wallSeconds ?? null;
  rec.timedOut = !!meta?.timedOut;
  if (tr) {
    rec.figmaCalls = sumBy(tr.tools, /^mcp__plugin_figma_figma__/);
    rec.batatabitCalls = sumBy(tr.tools, /^mcp__batatabit-ds__/);
    rec.validateFileCalls = sumBy(tr.tools, /^mcp__batatabit-ds__validate_file$/);
    rec.docsRead = tr.reads.filter((p) => /(AGENTS\.md|CLAUDE\.md|\/docs\/|\/src\/components\/[^/]+\/[^/]+\.md)$/.test(p)).length;
    rec.skillUsed = tr.skills.includes("build-section-from-figma");
    rec.skillsLoaded = tr.skills;
    rec.toolCalls = tr.tools;
    rec.figmaAvailable = (tr.init?.mcp_servers ?? []).some((m) => m.name === "plugin:figma:figma");
  }

  // ---- archivos cambiados o creados por el agente
  const diff = git(dir, "diff", "--name-only", "--diff-filter=ACMR", run.baseSha).split("\n").filter(Boolean);
  const untracked = git(dir, "ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  const ignore = (f) => /^(node_modules|dist|\.astro)(\/|$)/.test(f) || /(^|\/)package-lock\.json$/.test(f) || f.endsWith(".tsbuildinfo");
  const changed = [...new Set([...diff, ...untracked])].filter((f) => !ignore(f) && existsSync(join(dir, f)));
  rec.changedFiles = changed;

  // ---- validador (el del árbol principal, con las fichas y tokens del run)
  const codeFiles = changed.filter((f) => /\.(astro|css)$/.test(f));
  let issues = [];
  if (codeFiles.length) {
    const r = sh("node", [join(repoRoot, "mcp/src/validate-cli.ts"), "--json", ...codeFiles.map((f) => join(dir, f))], { cwd: repoRoot, env: { ...process.env, BATATABIT_ROOT: dir } });
    try { issues = JSON.parse(r.stdout).flatMap((x) => x.issues.map((i) => ({ ...i, file: x.path }))); } catch { rec.validatorError = r.out.slice(0, 300); }
  }
  rec.issueCount = issues.length;
  rec.issuesByRule = issues.reduce((o, i) => ({ ...o, [i.rule]: (o[i.rule] ?? 0) + 1 }), {});
  rec.rawHtmlIssues = rec.issuesByRule["raw-html-component"] ?? 0;
  rec.issues = issues.slice(0, 40);

  // ---- componentes del catálogo reutilizados
  const baseComponents = git(dir, "ls-tree", "-d", "--name-only", run.baseSha, "src/components/").split("\n").filter(Boolean).map((p) => p.split("/").pop());
  const used = {};
  // solo lo que el agente añadió: las líneas nuevas de un archivo existente, o el archivo entero si es nuevo
  const addedText = (f) => {
    if (untracked.includes(f)) return readFileSync(join(dir, f), "utf8");
    return git(dir, "diff", "-U0", run.baseSha, "--", f).split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
  };
  for (const f of changed.filter((f) => f.endsWith(".astro"))) {
    const text = addedText(f);
    for (const name of baseComponents) {
      if (f === `src/components/${name}/${name}.astro`) continue;
      const n = (text.match(new RegExp(`<${name}(?=[\\s/>])`, "g")) ?? []).length;
      if (n) used[name] = (used[name] ?? 0) + n;
    }
  }
  rec.componentsUsed = used;
  rec.componentsReused = Object.keys(used).length;
  rec.componentUses = Object.values(used).reduce((a, b) => a + b, 0);
  rec.reuseRatio = rec.componentUses + rec.rawHtmlIssues ? +(rec.componentUses / (rec.componentUses + rec.rawHtmlIssues)).toFixed(2) : null;

  // ---- componentes nuevos y su documentación
  const nowComponents = existsSync(join(dir, "src/components")) ? readdirSync(join(dir, "src/components")).filter((n) => statSync(join(dir, "src/components", n)).isDirectory()) : [];
  const created = nowComponents.filter((n) => !baseComponents.includes(n));
  rec.newComponents = created.length;
  rec.newComponentNames = created;
  rec.newComponentsDocumented = created.filter((n) => existsSync(join(dir, "src/components", n, `${n}.md`))).length;
  rec.newComponentsDocsPass = created.filter((n) => sh("node", [join(repoRoot, "scripts/check-docs.mjs"), "--root", dir, "--only", n], { cwd: repoRoot }).status === 0).length;

  // ---- astro check
  const check = sh("npx", ["astro", "check"], { cwd: dir });
  const num = (re) => Number(check.out.match(re)?.[1] ?? NaN);
  rec.astroErrors = num(/- (\d+) errors?/); rec.astroWarnings = num(/- (\d+) warnings?/); rec.astroHints = num(/- (\d+) hints?/);

  // ---- build, contraste, foco y comparación visual
  if (args["no-render"]) return rec;
  const build = sh("npm", ["run", "build"], { cwd: dir });
  rec.buildOk = build.status === 0 && existsSync(join(dir, "dist/index.html"));
  if (!rec.buildOk) { rec.buildError = build.out.split("\n").filter((l) => /error/i.test(l)).slice(0, 4).join(" | "); return rec; }
  const server = await serveDist(join(dir, "dist"), port);
  const url = `http://localhost:${port}/`;
  try {
    const audit = await shAsync("node", [join(repoRoot, "scripts/contrast/audit-page.mjs"), url, "375,834"], { cwd: repoRoot });
    const auditMatches = [...audit.out.matchAll(/px: \d+ text elements checked, (\d+) failures/g)];
    rec.contrastFailures = auditMatches.length === 2 ? auditMatches.reduce((n, m) => n + Number(m[1]), 0) : null;   // null = el script no produjo resultado
    rec.contrastSummary = audit.out.trim().split("\n").slice(-1)[0].slice(0, 200);
    const focus = await shAsync("node", [join(repoRoot, "scripts/contrast/focus-ring.mjs"), url, "375,834"], { cwd: repoRoot });
    rec.focusRingFailures = focus.out.match(/(\d+) failing elements/) ? Number(focus.out.match(/(\d+) failing elements/)[1]) : null;
    rec.focusSummary = focus.out.trim().split("\n").pop().slice(0, 200);
    const screens = join(resultsDir, "raw", run.id, "screens");
    mkdirSync(screens, { recursive: true });
    for (const width of [834, 375]) {
      const faqCrop = { headingTopInCrop: ref.faq[width].headingTopInCrop, height: ref.faq[width].crop.height, out: join(screens, `faq-${width}.png`) };
      const info = await inspect(url, width, { fullPath: join(screens, `full-${width}.png`), faqCrop });
      rec[`faq${width}`] = { found: info.headingFound, tag: info.headingTag, questions: info.questionsFound, interactive: info.toggleWorks, overflow: info.overflow, details: info.details ?? 0, ariaExpanded: info.ariaExpanded ?? 0 };
      if (width === 834) { rec.faqFound = info.headingFound; rec.positionCorrect = !!info.positionCorrect; rec.questionsFound = info.questionsFound; rec.interactive = info.toggleWorks; }
      rec[`noOverflow${width}`] = !info.overflow;
      if (info.faqPath) {
        const refPng = readPng(join(repoRoot, `bench/assets/figma-faq-${width}.png`));
        rec[`visualDiff${width}`] = visualDifference(refPng, cropPng(readPng(info.faqPath), 0, 0, refPng.width, refPng.height));
      }
    }
    rec.faqWorksBothWidths = !!(rec.faq834?.found && rec.faq375?.found && rec.noOverflow834 && rec.noOverflow375);
  } finally {
    server.close();
  }
  return rec;
}

// ---------------------------------------------------------------------------------------------
const manifest = readManifest().filter((r) => (!wantedRounds || wantedRounds.includes(r.round)) && (!wantedIds || wantedIds.includes(r.id)));
mkdirSync(resultsDir, { recursive: true });
const runs = [];
for (const run of manifest) {
  console.log(`[${run.id}] scoring…`);
  try { runs.push(await scoreRun(run, PORT)); }
  catch (e) { console.error(`[${run.id}] scoring failed: ${e.stack}`); runs.push({ id: run.id, round: run.round, run: run.run, scoreError: String(e.message) }); }
}

// ---- medianas por ronda
const NUM = ["issueCount", "componentsReused", "componentUses", "rawHtmlIssues", "reuseRatio", "newComponents", "newComponentsDocumented", "newComponentsDocsPass", "contrastFailures", "focusRingFailures", "astroErrors", "astroWarnings", "astroHints", "questionsFound", "visualDiff834", "visualDiff375", "durationSec", "totalTokens", "costUsd", "numTurns", "figmaCalls", "batatabitCalls", "validateFileCalls", "docsRead", "permissionDenials"];
const BOOL = ["ran", "agentFinished", "buildOk", "faqFound", "positionCorrect", "interactive", "noOverflow834", "noOverflow375", "faqWorksBothWidths", "figmaAvailable", "skillUsed"];
const medians = {};
for (const round of [...new Set(runs.map((r) => r.round))].sort()) {
  const rs = runs.filter((r) => r.round === round);
  const m = { runs: rs.length };
  for (const k of NUM) m[k] = median(rs.map((r) => r[k]));
  for (const k of BOOL) { const vals = rs.map((r) => r[k]).filter((v) => typeof v === "boolean"); m[k] = vals.length ? `${vals.filter(Boolean).length}/${vals.length}` : null; }
  const rules = [...new Set(rs.flatMap((r) => Object.keys(r.issuesByRule ?? {})))].sort();
  m.issuesByRule = Object.fromEntries(rules.map((rule) => [rule, median(rs.map((r) => r.issuesByRule?.[rule] ?? 0))]));
  medians[round] = m;
}
const out = { generatedAt: new Date().toISOString(), tag: config.tag, model: config.model, rounds: config.rounds, runs, medians };
writeFileSync(join(resultsDir, "results.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`results.json written: ${runs.length} runs`);
await report(out);
console.log("summary.md, screenshots/ and excerpts/ written");
