# Benchmark: does the design system and its AI layer help an agent build a feature?

The same model gets the same two tasks in four versions of the project, and one scorer scores every run.

## Rounds

| Round | Code | Figma file | What the agent has |
|---|---|---|---|
| **R0** | tag `v1-astro-parity` | original duplicate (`BataBit-backup`) | No design system at all: one `global.css`, no tokens, no components, no docs. |
| **A** | tag `v7-ai-layer` | current (`BataBit`) | Tokens and components in code, variables with WEB code syntax in Figma. No `AGENTS.md`, no `CLAUDE.md`, no `docs/`, no component guides, no `batatabit-ds` MCP, no skill. |
| **B** | tag `v7-ai-layer` | current | A plus `AGENTS.md`, `CLAUDE.md`, `docs/` and the component guides. No MCP, no skill. |
| **C** | tag `v7-ai-layer` | current | Everything: B plus the `batatabit-ds` MCP server and the `build-section-from-figma` skill. |

A is not a "no context" baseline: the code and the Figma variables already carry most of the system. R0 is the no-system baseline.

## Tasks

- **T1, with Figma** (`tasks/t1-faq.md`): implement the FAQ section from the Figma "Tablet ≥768" frame, in the position it has in the design. The prompt links the file, the frame and one node, the group named `FAQ` (heading and four question rows with chevrons). R0 gets the same prompt with the links of the original Figma file.
- **T2, no design** (`tasks/t2-testimonials.md`): add a testimonials section with 3 testimonials between the plans and the footer, matching the rest of the page. No design is provided and every Figma tool is denied, so the agent makes the design decisions.

Both must work on mobile and tablet. Prompts are identical in every round (only the Figma links change in R0).

## Run it

```bash
node bench/setup.mjs --runs 1        # fresh copies: one per round and task (default runsPerCell = 3)
node bench/run.mjs                   # headless runs, one at a time (--rounds r0,a  --tasks t1  --ids a-t1-1)
node bench/score.mjs                 # scores every run and writes bench/results/
node bench/lib/report.mjs            # only regenerates summary, screenshots and excerpts from results.json
```

Run ids are `<round>-<task>-<n>`, for example `r0-t2-1`. Requirements: `claude` on the PATH and logged in, the Figma plugin enabled and authenticated, Node 22.18 or newer, and the repository's dependencies installed. `setup.mjs` recreates every working copy from scratch (the transcripts in `bench/results/raw/` are kept until you delete them).

## How the agent is run

`bench/run.mjs` calls `claude -p` once per run, in the run's own folder, with the prompt on stdin: `--output-format stream-json --verbose` (the full transcript), `--permission-mode acceptEdits`, `--max-budget-usd`, and `--settings bench/assets/claude-settings.json`. One shot, no follow-up. This version of Claude Code has no `--max-turns`, so a run is bounded by budget and wall-clock time. `--bare` is not used: it skips skills, `CLAUDE.md`, MCP servers and plugins, which are exactly what the rounds vary.

**Permissions are the same in every round** and live in `assets/claude-settings.json`: build and shell commands (`npm run`, `npx`, `node`, `curl`, `mkdir`, `cat`, `cp`, `mv`, `sed`, read-only `git` and so on), `/tmp` access (so Figma screenshots can be downloaded and read), the Figma and `batatabit-ds` MCP servers, and a deny list: no `git push`, and none of the Figma tools that write. T2 also runs with `--disallowedTools mcp__plugin_figma_figma`.

The file is passed with `--settings` and is not copied to `.claude/settings.json` in each project because Claude Code ignores the permissions of a project it has not been told to trust, and a fresh clone is never trusted in headless mode. Two command shapes stay blocked by Claude Code's own command parser whatever the allow list says: a heredoc after `&&` (`mkdir … && cat > f <<EOF`) and two `cd` in one command. They are blocked identically in every round, and the agents fall back to the Write tool or absolute paths.

## Decisions to know about

- **Clones without history, not `git worktree`.** Claude Code treats a worktree as part of the main repository and loads its skills and memory. `setup.mjs` makes an independent local clone of the tag, removes `AUDIT.md` and `PHASE5-PROPOSAL.md` (long design-system guidance), applies what the round removes, then deletes `.git` and starts a new one-commit history. The agent cannot read other tags or commit messages.
- **What stays in every round.** The machine's user-level plugins and skills (Figma's design-to-code skill, for example) apply to every round equally; the scorer records which skills each run loaded. In A, `mcp/` and the `ds:validate` and `docs:check` scripts still exist; their guides and MCP registration are gone.
- **Figma server timing.** The Figma plugin server connects asynchronously and can show `pending` at session start. The scorer records `figmaAvailable` and the number of Figma calls, so a run that never reached Figma is visible.
- **Figma references.** `assets/figma-faq-*.png` come from the current file and `assets/figma-r0-faq-*.png` from the original; both are the tablet frame (834px) and `iPhone 8 - 1` (375px), anchored 40px above the FAQ heading. In the original the tablet frame is still called `iPad Pro 11" - 1`.

## What is scored

The same scorer (`score.mjs`) runs on every run, using the main tree's validator, `docs:check`, contrast and focus scripts:

- **Validator issues by rule.** The validator runs against the v7 catalog and tokens with the agent's changed files laid on top, and only issues on lines the agent added are counted. R0 has no tokens or components, so its raw colours, spacings, fonts, radii and hand-made markup count exactly as anyone else's.
- Catalog components reused (on the added lines) against raw HTML where a component exists; new components created, with a guide, and whether the guide passes `docs:check --only <Name>`.
- **New** WCAG AA contrast failures and focus-ring failures at 375 and 834px, and **new** `astro check` errors, warnings and hints: each is measured against the starting state of the round, because the original (R0) already has failures of its own.
- **T1:** the FAQ is found, in the design's position (after the plans, before the footer), has the four questions, a question opens and closes, no horizontal overflow at 375 and 834px, and a visual difference against the Figma crop (greyscale, 4× reduced, mean absolute difference; it ranks runs, the side-by-side images are the real comparison).
- **T2:** a section appears between the plans and the footer, how many testimonials it holds, no horizontal overflow, and how many colours and font families inside it appear nowhere else on the page (a proxy for "matches the rest of the page"; the screenshots are the real comparison).
- Duration, turns, tokens and cost from the run's result event, which skills it loaded, and permission denials.

## Output

`bench/results/`: `results.json` (every run and the medians per task and round), `summary.md` (the R0 / A / B / C × T1 / T2 tables), `screenshots/` (side by side per task and width) and `excerpts/` (the worst validator output per cell). `raw/` (transcripts) is git-ignored.
