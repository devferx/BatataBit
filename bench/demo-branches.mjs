// Trae cada resultado de la demo a este repositorio como una rama propia que contiene solo los cambios del agente
// encima de su punto de partida. No toca la copia de trabajo de main (usa un worktree temporal) y no fusiona nada.
// Uso: BENCH_DIR=../BatataBit-demo node bench/demo-branches.mjs
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { benchDir, git, readManifest, repoRoot } from "./lib/common.mjs";

const SPEC = {
  before: {
    branch: "feat/login-before-design-tokens",
    base: "v1-astro-parity",
    subject: "feat(login): login page built in the original Astro port, before the design system",
    body: "Produced by a one-shot headless Claude run (claude-sonnet-5-5) in the \"before\" setup: a one-commit clone of tag v1-astro-parity\n(Astro, one global CSS; no tokens, no components, no docs, no AGENTS.md, no MCP, no skill; Figma tools denied).\nOnly the agent's files are committed, on top of v1-astro-parity. Illustrates the cost of having no design system: do not merge.",
  },
  after: {
    branch: "feat/login",
    base: "main",
    subject: "feat(login): login page built with the design system, tokens, components, docs, MCP and skill",
    body: "Produced by a one-shot headless Claude run (claude-sonnet-5-5) in the \"after\" setup: a one-commit clone of main\n(tokens, components with guides, AGENTS.md, batatabit-ds MCP and the build-section-from-figma skill; Figma tools denied).\nOnly the agent's files are committed, on top of main. This is the clean version.",
  },
};
const ignore = (f) => /^(node_modules|dist|\.astro)(\/|$)/.test(f) || /(^|\/)package-lock\.json$/.test(f) || f.endsWith(".tsbuildinfo");

for (const [round, spec] of Object.entries(SPEC)) {
  const m = readManifest().find((x) => x.round === round && x.task === "t3");
  const wt = join(benchDir, "worktrees", round);
  rmSync(wt, { recursive: true, force: true });
  mkdirSync(dirname(wt), { recursive: true });
  git(repoRoot, "worktree", "add", "-q", "-b", spec.branch, wt, spec.base);   // falla si la rama ya existe
  const tracked = git(m.dir, "diff", "--name-status", m.baseSha).split("\n").filter(Boolean).map((l) => l.split("\t"));
  const untracked = git(m.dir, "ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean).map((f) => ["A", f]);
  const files = [];
  for (const [status, f] of [...tracked, ...untracked]) {
    if (ignore(f)) continue;
    if (status === "D") { rmSync(join(wt, f), { force: true }); files.push(`D ${f}`); continue; }
    mkdirSync(dirname(join(wt, f)), { recursive: true });
    copyFileSync(join(m.dir, f), join(wt, f));
    files.push(`${status === "A" ? "A" : "M"} ${f}`);
  }
  git(wt, "add", "-A");
  git(wt, "commit", "-q", "-m", `${spec.subject}\n\n${spec.body}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`);
  git(repoRoot, "worktree", "remove", "--force", wt);
  console.log(`${spec.branch} (from ${spec.base}):\n  ${files.join("\n  ")}`);
}
