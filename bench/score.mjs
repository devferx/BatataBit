// Puntúa cada run con el mismo código para todas las rondas y tareas y escribe bench/results/.
// Mide solo lo que el agente cambió o creó: los problemas del validador en las líneas que añadió, y los fallos de
// contraste, foco y `astro check` que aparecen de más respecto al estado de partida de su ronda (en r0 el original
// ya tiene los suyos). Usa los validadores y scripts del árbol principal, no los del run.
// Uso: node bench/score.mjs [--rounds r0,a,b,c] [--tasks t1,t2] [--ids a-t1-1] [--no-render]
import { spawn, spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { benchDir, config, git, median, parseArgs, readManifest, repoRoot, resultsDir } from "./lib/common.mjs";
import { crop as cropPng, readPng, visualDifference } from "./lib/images.mjs";
import { inspect, serveDist } from "./lib/render.mjs";
import { report } from "./lib/report.mjs";

const args = parseArgs(process.argv.slice(2));
const wantedRounds = args.rounds ? String(args.rounds).split(",") : null;
const wantedIds = args.ids ? String(args.ids).split(",") : null;
const wantedTasks = args.tasks ? String(args.tasks).split(",") : null;
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
// Estado de partida de cada etiqueta: lo que ya falla antes de que el agente toque nada.
const shRun = sh;
const countsOf = (out) => {
  const num = (re) => Number(out.match(re)?.[1] ?? NaN);
  return { errors: num(/- (\d+) errors?/), warnings: num(/- (\d+) warnings?/), hints: num(/- (\d+) hints?/) };
};

/** Contraste y foco de la página servida: los fallos de contraste como textos (para restar los del original). */
async function auditPage(url) {
  const audit = await shAsync("node", [join(repoRoot, "scripts/contrast/audit-page.mjs"), url, "375,834"], { cwd: repoRoot });
  const fails = [];
  let width = null, widthsSeen = 0;
  for (const line of audit.out.split("\n")) {
    const w = line.match(/^(\d+)px: \d+ text elements checked/);
    if (w) { width = w[1]; widthsSeen++; continue; }
    const f = line.match(/^\s+FAIL (.*)$/);
    if (f) fails.push(`${width}|${f[1]}`);
  }
  const focus = await shAsync("node", [join(repoRoot, "scripts/contrast/focus-ring.mjs"), url, "375,834"], { cwd: repoRoot });
  const fm = focus.out.match(/(\d+) failing elements/);
  return { contrastFails: widthsSeen === 2 ? fails : null, contrastSummary: audit.out.trim().split("\n").slice(-1)[0].slice(0, 200), focusFailing: fm ? Number(fm[1]) : null, focusSummary: focus.out.trim().split("\n").pop().slice(0, 200) };
}

/** Árbol limpio de una etiqueta (sin nada del agente), con su `astro check`, y sus fallos de contraste y foco. */
async function baselineFor(tag) {
  const dirBase = join(benchDir, "baselines");
  const file = join(dirBase, `${tag}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(dirBase, { recursive: true });
  const dir = join(dirBase, `tree-${tag}`);
  rmSync(dir, { recursive: true, force: true });
  execFileSync("git", ["clone", "-q", "--local", "--no-hardlinks", repoRoot, dir]);
  git(dir, "checkout", "-q", "--detach", tag);
  for (const f of config.removeEverywhere) rmSync(join(dir, f), { recursive: true, force: true });
  symlinkSync(join(repoRoot, "node_modules"), join(dir, "node_modules"), "dir");
  const base = { tag, astro: countsOf(shRun("npx", ["astro", "check"], { cwd: dir }).out) };
  const build = shRun("npm", ["run", "build"], { cwd: dir });
  if (build.status !== 0) throw new Error(`baseline ${tag} does not build: ${build.out.slice(-300)}`);
  const server = await serveDist(join(dir, "dist"), PORT);
  try { Object.assign(base, await auditPage(`http://localhost:${PORT}/`)); } finally { server.close(); }
  writeFileSync(file, JSON.stringify(base, null, 2) + "\n");
  return base;
}

/** Copia de referencia (catálogo, tokens y docs de v7) sobre la que se validan los cambios de cualquier ronda. */
function referenceRoot() {
  const dir = join(benchDir, "baselines", "ref-v7-ai-layer");
  if (existsSync(dir)) return dir;
  mkdirSync(dir, { recursive: true });
  const tar = execFileSync("git", ["archive", "v7-ai-layer", "src", "docs", "package.json"], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  return dir;
}

/** Líneas añadidas a un archivo respecto al commit base (null = archivo nuevo, todas las líneas). */
function addedLineSet(dir, base, f, isNew) {
  if (isNew) return null;
  const set = new Set();
  for (const l of git(dir, "diff", "-U0", base, "--", f).split("\n")) {
    const m = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    const start = Number(m[1]), n = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < n; i++) set.add(start + i);
  }
  return set;
}

// ---------------------------------------------------------------------------------------------
async function scoreRun(run, port) {
  const dir = run.dir;
  const task = run.task;
  const rec = { id: run.id, round: run.round, task, run: run.run, tag: run.tag, scoredAt: new Date().toISOString() };
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

  // ---- validador: la copia de referencia de v7 (catálogo, tokens y docs) con los archivos del agente encima,
  // y solo cuentan los problemas de las líneas que el agente añadió. Igual en todas las rondas, también en r0.
  const codeFiles = changed.filter((f) => /\.(astro|css)$/.test(f));
  const overlay = join(benchDir, "overlays", run.id);
  rmSync(overlay, { recursive: true, force: true });
  cpSync(referenceRoot(), overlay, { recursive: true });
  for (const f of changed) { mkdirSync(join(overlay, f, ".."), { recursive: true }); cpSync(join(dir, f), join(overlay, f)); }
  let issues = [];
  if (codeFiles.length) {
    const r = sh("node", [join(repoRoot, "mcp/src/validate-cli.ts"), "--json", ...codeFiles.map((f) => join(overlay, f))], { cwd: repoRoot, env: { ...process.env, BATATABIT_ROOT: overlay } });
    try {
      issues = JSON.parse(r.stdout).flatMap((x) => {
        const rel = x.path.replace(/^.*?(?=src\/)/, "").replace(overlay + "/", "");
        const added = addedLineSet(dir, run.baseSha, rel, untracked.includes(rel));
        return x.issues.filter((i) => !added || added.has(i.line)).map((i) => ({ ...i, file: rel }));
      });
    } catch { rec.validatorError = r.out.slice(0, 300); }
  }
  rec.issueCount = issues.length;
  rec.issuesByRule = issues.reduce((o, i) => ({ ...o, [i.rule]: (o[i.rule] ?? 0) + 1 }), {});
  rec.rawHtmlIssues = rec.issuesByRule["raw-html-component"] ?? 0;
  rec.rawValueIssues = Object.entries(rec.issuesByRule).filter(([k]) => /^raw-(color|spacing|font|line|letter|radius|shadow|border|class)/.test(k)).reduce((n, [, v]) => n + v, 0);
  rec.issues = issues.slice(0, 40);

  // ---- componentes del catálogo reutilizados (los que existían en el estado de partida del run)
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

  // ---- componentes nuevos y su documentación (la guía se comprueba contra los tokens de v7, como el validador)
  const nowComponents = existsSync(join(dir, "src/components")) ? readdirSync(join(dir, "src/components")).filter((n) => statSync(join(dir, "src/components", n)).isDirectory()) : [];
  const created = nowComponents.filter((n) => !baseComponents.includes(n));
  rec.newComponents = created.length;
  rec.newComponentNames = created;
  rec.newComponentsDocumented = created.filter((n) => existsSync(join(dir, "src/components", n, `${n}.md`))).length;
  rec.newComponentsDocsPass = created.filter((n) => sh("node", [join(repoRoot, "scripts/check-docs.mjs"), "--root", overlay, "--only", n], { cwd: repoRoot }).status === 0).length;

  const base = await baselineFor(run.tag);

  // ---- astro check (solo lo que aparece de más respecto al estado de partida)
  const check = sh("npx", ["astro", "check"], { cwd: dir });
  const c = countsOf(check.out);
  rec.astroErrors = Number.isNaN(c.errors) ? NaN : Math.max(0, c.errors - base.astro.errors);
  rec.astroWarnings = Number.isNaN(c.warnings) ? NaN : Math.max(0, c.warnings - base.astro.warnings);
  rec.astroHints = Number.isNaN(c.hints) ? NaN : Math.max(0, c.hints - base.astro.hints);
  rec.astroRaw = c;

  // ---- build, contraste, foco y comparación visual
  if (args["no-render"]) return rec;
  const build = sh("npm", ["run", "build"], { cwd: dir });
  rec.buildOk = build.status === 0 && existsSync(join(dir, "dist/index.html"));
  if (!rec.buildOk) { rec.buildError = build.out.split("\n").filter((l) => /error/i.test(l)).slice(0, 4).join(" | "); return rec; }
  const server = await serveDist(join(dir, "dist"), port);
  const url = `http://localhost:${port}/`;
  try {
    const a = await auditPage(url);
    const baseFails = new Set(base.contrastFails ?? []);
    rec.contrastFailures = a.contrastFails ? a.contrastFails.filter((f) => !baseFails.has(f)).length : null;   // null = el script no produjo resultado
    rec.contrastFailuresTotal = a.contrastFails?.length ?? null;
    rec.contrastSummary = a.contrastSummary;
    rec.focusRingFailures = a.focusFailing === null || base.focusFailing === null ? null : Math.max(0, a.focusFailing - base.focusFailing);
    rec.focusSummary = a.focusSummary;
    const screens = join(resultsDir, "raw", run.id, "screens");
    mkdirSync(screens, { recursive: true });
    const refPrefix = run.round === "r0" ? "figma-r0-faq" : "figma-faq";
    for (const width of [834, 375]) {
      const faqCrop = { headingTopInCrop: ref.faq[width].headingTopInCrop, height: ref.faq[width].crop.height, out: join(screens, `faq-${width}.png`) };
      const info = await inspect(url, width, { task, fullPath: join(screens, `full-${width}.png`), faqCrop, regionPath: join(screens, `region-${width}.png`) });
      rec[`noOverflow${width}`] = !info.overflow;
      if (task === "t1") {
        rec[`faq${width}`] = { found: info.headingFound, tag: info.headingTag, questions: info.questionsFound, interactive: info.toggleWorks, overflow: info.overflow, details: info.details ?? 0, ariaExpanded: info.ariaExpanded ?? 0 };
        if (width === 834) { rec.faqFound = info.headingFound; rec.positionCorrect = !!info.positionCorrect; rec.questionsFound = info.questionsFound; rec.interactive = info.toggleWorks; }
        if (info.faqPath) {
          const refPng = readPng(join(repoRoot, `bench/assets/${refPrefix}-${width}.png`));
          rec[`visualDiff${width}`] = visualDifference(refPng, cropPng(readPng(info.faqPath), 0, 0, refPng.width, refPng.height));
        }
      } else {
        rec[`region${width}`] = { found: info.regionFound, items: info.items ?? 0, mentions: info.mentionsTestimonials ?? false, offPaletteColors: info.offPaletteColors ?? null, offFonts: info.offFonts ?? null, colors: info.regionColors ?? [], fonts: info.regionFonts ?? [] };
        if (width === 834) { rec.testimonialsFound = info.regionFound; rec.positionCorrect = !!info.positionCorrect; rec.testimonialItems = info.items ?? 0; rec.offPaletteColors = info.offPaletteColors ?? null; rec.offFonts = info.offFonts ?? null; }
        else { rec.offPaletteColors375 = info.offPaletteColors ?? null; }
      }
    }
    rec.featureWorksBothWidths = task === "t1"
      ? !!(rec.faq834?.found && rec.faq375?.found && rec.noOverflow834 && rec.noOverflow375)
      : !!(rec.region834?.found && rec.region375?.found && rec.noOverflow834 && rec.noOverflow375);
  } finally {
    server.close();
  }
  return rec;
}

// ---------------------------------------------------------------------------------------------
const manifest = readManifest().filter((r) => (!wantedRounds || wantedRounds.includes(r.round)) && (!wantedTasks || wantedTasks.includes(r.task)) && (!wantedIds || wantedIds.includes(r.id)));
mkdirSync(resultsDir, { recursive: true });
const runs = [];
for (const run of manifest) {
  console.log(`[${run.id}] scoring…`);
  try { runs.push(await scoreRun(run, PORT)); }
  catch (e) { console.error(`[${run.id}] scoring failed: ${e.stack}`); runs.push({ id: run.id, round: run.round, task: run.task, run: run.run, scoreError: String(e.message) }); }
}

// ---- medianas por tarea y ronda
const NUM = ["issueCount", "rawValueIssues", "componentsReused", "componentUses", "rawHtmlIssues", "reuseRatio", "newComponents", "newComponentsDocumented", "newComponentsDocsPass", "contrastFailures", "focusRingFailures", "astroErrors", "astroWarnings", "astroHints", "questionsFound", "visualDiff834", "visualDiff375", "testimonialItems", "offPaletteColors", "offFonts", "durationSec", "totalTokens", "costUsd", "numTurns", "figmaCalls", "batatabitCalls", "validateFileCalls", "docsRead", "permissionDenials"];
const BOOL = ["ran", "agentFinished", "buildOk", "faqFound", "testimonialsFound", "positionCorrect", "interactive", "noOverflow834", "noOverflow375", "featureWorksBothWidths", "figmaAvailable", "skillUsed"];
const medians = {};
for (const task of [...new Set(runs.map((r) => r.task))].sort()) {
  medians[task] = {};
  for (const round of [...new Set(runs.filter((r) => r.task === task).map((r) => r.round))]) {
    const rs = runs.filter((r) => r.task === task && r.round === round);
    const m = { runs: rs.length };
    for (const k of NUM) m[k] = median(rs.map((r) => r[k]));
    for (const k of BOOL) { const vals = rs.map((r) => r[k]).filter((v) => typeof v === "boolean"); m[k] = vals.length ? `${vals.filter(Boolean).length}/${vals.length}` : null; }
    const rules = [...new Set(rs.flatMap((r) => Object.keys(r.issuesByRule ?? {})))].sort();
    m.issuesByRule = Object.fromEntries(rules.map((rule) => [rule, median(rs.map((r) => r.issuesByRule?.[rule] ?? 0))]));
    m.skills = [...new Set(rs.flatMap((r) => r.skillsLoaded ?? []))];
    medians[task][round] = m;
  }
}
const out = { generatedAt: new Date().toISOString(), model: config.model, rounds: config.rounds, tasks: config.tasks, runs, medians };
writeFileSync(join(resultsDir, "results.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`results.json written: ${runs.length} runs`);
await report(out);
console.log("summary.md, screenshots/ and excerpts/ written");
