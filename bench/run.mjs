// Ejecuta cada run en modo headless (`claude -p`), con el mismo modelo, una sola pasada y sin seguimiento,
// y guarda la transcripción completa (stream-json) y el resultado final.
// Uso: node bench/run.mjs [--rounds r0,a] [--tasks t1] [--ids a-t1-1] [--dry]
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, parseArgs, readManifest, renderPrompt, repoRoot, resultsDir } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const wantedRounds = args.rounds ? String(args.rounds).split(",") : null;
const wantedIds = args.ids ? String(args.ids).split(",") : null;
const wantedTasks = args.tasks ? String(args.tasks).split(",") : null;

const claudeArgs = [
  "-p",
  "--output-format", "stream-json",
  "--verbose",
  "--model", config.model,
  "--permission-mode", "acceptEdits",
  "--max-budget-usd", String(config.maxBudgetUsd),
  // La misma lista de permisos para todas las rondas. Va por --settings y no en .claude/settings.json del proyecto:
  // Claude Code ignora los permisos de un proyecto no confiado, y un clon nuevo nunca lo está en modo headless.
  "--settings", join(repoRoot, config.settingsTemplate),
];

const runs = readManifest().filter((r) => (!wantedRounds || wantedRounds.includes(r.round)) && (!wantedTasks || wantedTasks.includes(r.task)) && (!wantedIds || wantedIds.includes(r.id)));
if (args.dry) {
  console.log(`(permissions come from bench/assets/claude-settings.json via --settings; tasks without a design also get --disallowedTools mcp__plugin_figma_figma)`);
  console.log(`claude ${claudeArgs.map((a) => (/[\s*(]/.test(a) ? JSON.stringify(a) : a)).join(" ")}  < prompt`);
  console.log(runs.map((r) => r.id).join(", "));
  for (const r of runs) console.log(`\n--- prompt ${r.id} ---\n${renderPrompt(r.round, r.task)}`);
  process.exit(0);
}

async function runOne(run) {
  const out = join(resultsDir, "raw", run.id);
  mkdirSync(out, { recursive: true });
  const transcript = createWriteStream(join(out, "transcript.jsonl"));
  const stderr = createWriteStream(join(out, "stderr.log"));
  const started = Date.now();
  console.log(`[${run.id}] start (${run.dir})`);
  const prompt = renderPrompt(run.round, run.task);
  writeFileSync(join(out, "prompt.txt"), prompt + "\n");
  const runArgs = config.tasks[run.task].figma ? claudeArgs : [...claudeArgs, "--disallowedTools", "mcp__plugin_figma_figma"];
  const child = spawn("claude", runArgs, { cwd: run.dir, stdio: ["pipe", "pipe", "pipe"], env: process.env });
  child.stdout.pipe(transcript);
  child.stderr.pipe(stderr);
  child.stdin.end(prompt + "\n");
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, config.timeoutMinutes * 60_000);
  const code = await new Promise((resolve) => child.on("close", resolve));
  clearTimeout(timer);
  await new Promise((resolve) => transcript.end(resolve));
  const meta = { id: run.id, round: run.round, task: run.task, run: run.run, dir: run.dir, baseSha: run.baseSha, model: config.model, startedAt: new Date(started).toISOString(), wallSeconds: Math.round((Date.now() - started) / 1000), exitCode: code, timedOut, command: `claude ${runArgs.join(" ")}` };
  writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`[${run.id}] done in ${meta.wallSeconds}s (exit ${code}${timedOut ? ", TIMED OUT" : ""})`);
}

for (const run of runs) await runOne(run);   // en serie: un único agente a la vez
