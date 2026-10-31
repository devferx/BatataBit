// Ejecuta cada run en modo headless (`claude -p`), con el mismo modelo, una sola pasada y sin seguimiento,
// y guarda la transcripción completa (stream-json) y el resultado final.
// Uso: node bench/run.mjs [--rounds a,b,c] [--ids a-1,b-1] [--dry]
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, parseArgs, readManifest, repoRoot, resultsDir } from "./lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
const wantedRounds = args.rounds ? String(args.rounds).split(",") : null;
const wantedIds = args.ids ? String(args.ids).split(",") : null;
const prompt = readFileSync(join(repoRoot, "bench/task.md"), "utf8").trim();

const claudeArgs = [
  "-p",
  "--output-format", "stream-json",
  "--verbose",
  "--model", config.model,
  "--permission-mode", "acceptEdits",
  "--allowedTools", config.allowedTools.join(","),
  "--max-budget-usd", String(config.maxBudgetUsd),
];

const runs = readManifest().filter((r) => (!wantedRounds || wantedRounds.includes(r.round)) && (!wantedIds || wantedIds.includes(r.id)));
if (args.dry) {
  console.log(`claude ${claudeArgs.map((a) => (/[\s*(]/.test(a) ? JSON.stringify(a) : a)).join(" ")}  < bench/task.md`);
  console.log(runs.map((r) => r.id).join(", "));
  process.exit(0);
}

async function runOne(run) {
  const out = join(resultsDir, "raw", run.id);
  mkdirSync(out, { recursive: true });
  const transcript = createWriteStream(join(out, "transcript.jsonl"));
  const stderr = createWriteStream(join(out, "stderr.log"));
  const started = Date.now();
  console.log(`[${run.id}] start (${run.dir})`);
  const child = spawn("claude", claudeArgs, { cwd: run.dir, stdio: ["pipe", "pipe", "pipe"], env: process.env });
  child.stdout.pipe(transcript);
  child.stderr.pipe(stderr);
  child.stdin.end(prompt + "\n");
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, config.timeoutMinutes * 60_000);
  const code = await new Promise((resolve) => child.on("close", resolve));
  clearTimeout(timer);
  await new Promise((resolve) => transcript.end(resolve));
  const meta = { id: run.id, round: run.round, run: run.run, dir: run.dir, baseSha: run.baseSha, model: config.model, startedAt: new Date(started).toISOString(), wallSeconds: Math.round((Date.now() - started) / 1000), exitCode: code, timedOut, command: `claude ${claudeArgs.join(" ")}` };
  writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`[${run.id}] done in ${meta.wallSeconds}s (exit ${code}${timedOut ? ", TIMED OUT" : ""})`);
}

for (const run of runs) await runOne(run);   // en serie: un único agente a la vez
