// Utilidades compartidas por setup, run y score.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const config = JSON.parse(readFileSync(join(repoRoot, "bench/config.json"), "utf8"));
export const benchDir = resolve(repoRoot, process.env.BENCH_DIR ?? config.benchDir);
export const manifestPath = join(benchDir, "manifest.json");
export const resultsDir = join(repoRoot, "bench/results");

export const cellId = (round, task, run) => `${round}-${task}-${run}`;

export const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

export const readManifest = () => {
  if (!existsSync(manifestPath)) throw new Error(`No manifest at ${manifestPath}. Run: node bench/setup.mjs`);
  return JSON.parse(readFileSync(manifestPath, "utf8"));
};

export const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
};

export const median = (values) => {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** Prompt of a task for a round: the same text, with the links of the Figma file that round uses. */
export const renderPrompt = (round, task) => {
  const text = readFileSync(join(repoRoot, config.tasks[task].prompt), "utf8").trim();
  const f = config.figmaFiles[config.rounds[round].figma];
  return text.replaceAll("{{FILE_KEY}}", f.key).replaceAll("{{FILE_NAME}}", f.name).replaceAll("{{FRAME_NODE}}", f.frameNode).replaceAll("{{FAQ_NODE}}", f.faqNode);
};
