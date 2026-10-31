// Crea una copia limpia por ronda, tarea y ejecución desde la etiqueta de cada ronda (r0: v1-astro-parity;
// a, b, c: v7-ai-layer), aplica lo que cada ronda quita y registra
// el commit base en el manifiesto.
//
// Son clones locales independientes y no `git worktree`: Claude Code asocia un worktree al repositorio principal
// y carga desde él las skills del proyecto (y su carpeta de memoria), con lo que la ronda A vería la skill de la
// ronda C. Un clon independiente es un proyecto distinto y no hereda nada.
// Uso: node bench/setup.mjs [--runs 3] [--rounds r0,a,b,c] [--tasks t1,t2]   (recrea todo desde cero)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { benchDir, cellId, config, git, manifestPath, parseArgs, repoRoot } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const runs = Number(args.runs ?? config.runsPerCell);
const rounds = String(args.rounds ?? Object.keys(config.rounds).join(",")).split(",");
const tasks = String(args.tasks ?? Object.keys(config.tasks).join(",")).split(",");
mkdirSync(benchDir, { recursive: true });

// ---- qué quita cada ronda (sobre el estado de la etiqueta)
const rm = (dir, rel) => rmSync(join(dir, rel), { recursive: true, force: true });

function removeMcpEntry(dir) {
  const p = join(dir, ".mcp.json");
  if (!existsSync(p)) return;
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  delete cfg.mcpServers?.["batatabit-ds"];
  writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
}
function removeSkills(dir) {
  rm(dir, ".claude/skills");
  const claude = join(dir, ".claude");
  if (existsSync(claude) && readdirSync(claude).length === 0) rm(dir, ".claude");
}
function removeComponentGuides(dir) {
  const comps = join(dir, "src/components");
  for (const name of readdirSync(comps)) {
    const full = join(comps, name);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full)) if (f.endsWith(".md")) rmSync(join(full, f));
  }
}

const apply = {
  a(dir) { rm(dir, "AGENTS.md"); rm(dir, "CLAUDE.md"); rm(dir, "docs"); removeComponentGuides(dir); removeMcpEntry(dir); removeSkills(dir); },
  b(dir) { removeMcpEntry(dir); removeSkills(dir); },
  c() {},
  r0() {},
};

const manifest = [];
for (const round of rounds) for (const task of tasks) for (let run = 1; run <= runs; run++) {
  const id = cellId(round, task, run);
  const tag = config.rounds[round].tag;
  const dir = join(benchDir, `round-${round}-${task}-run${run}`);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  execFileSync("git", ["clone", "-q", "--local", "--no-hardlinks", repoRoot, dir]);
  git(dir, "checkout", "-q", "--detach", tag);
  for (const f of config.removeEverywhere) rm(dir, f);   // historial del proyecto con pistas sobre el sistema de diseño
  apply[round](dir);
  // sin historial: el agente no puede leer etiquetas ni commits de otras rondas
  rm(dir, ".git");
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=bench", "-c", "user.email=bench@local", "commit", "-q", "-m", `bench setup: ${round} ${task}`);
  const baseSha = git(dir, "rev-parse", "HEAD");
  // dependencias compartidas (después del commit: un enlace simbólico no lo ignora node_modules/ de .gitignore)
  symlinkSync(join(repoRoot, "node_modules"), join(dir, "node_modules"), "dir");
  manifest.push({ id, round, task, run, dir, baseSha, tag, kind: "clone", createdAt: new Date().toISOString() });
  console.log(`${id}: ${dir} @ ${baseSha.slice(0, 8)} (${tag})`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${manifestPath}`);
