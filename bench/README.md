# Benchmark: does the AI layer help an agent build a feature?

The same task is given to the same model in three versions of the project, and the results are scored by one scorer.

> Implement the FAQ section from the Figma "Tablet ≥768" frame and add it to the landing page in the position it has in the design. It must work on mobile and tablet.

| Round | What the agent has |
|---|---|
| **A** | The code and the Figma MCP. No `AGENTS.md`, no `CLAUDE.md`, no `docs/`, no component guides, no `batatabit-ds` MCP, no skill. |
| **B** | A plus `AGENTS.md`, `CLAUDE.md`, `docs/` and the component guides. No `batatabit-ds` MCP, no skill. |
| **C** | Everything: B plus the `batatabit-ds` MCP server and the `build-section-from-figma` skill. |

The exact prompt is in `task.md` (with the Figma links). The FAQ is not a single Figma node: it is the heading `430:222` and four question rows with chevrons (`430:223` to `430:236`) that sit loose in the tablet frame, so the prompt names them.

## Run it

```bash
node bench/setup.mjs --runs 3        # three fresh copies per round (default 3)
node bench/run.mjs                   # headless agent runs, one at a time (add --rounds a,b or --ids a-1 to select)
node bench/score.mjs                 # scores every run and writes bench/results/
node bench/lib/report.mjs               # only regenerates summary, screenshots and excerpts from results.json
```

Requirements: `claude` on the PATH and logged in, the Figma plugin enabled and authenticated (the runs use the same user configuration as your terminal), Node 22.18 or newer, and the repository's dependencies installed. `setup.mjs` recreates every run from scratch, so a new `setup` discards earlier runs' working copies (the transcripts in `bench/results/raw/` are kept until you delete them).

A run is capped by `maxBudgetUsd` and `timeoutMinutes` in `config.json`; change `model` there to change the model for every run.

## How the agent is run

`bench/run.mjs` calls `claude -p` (print mode) once per run, in the run's own folder, with the prompt on stdin: `--output-format stream-json --verbose` (the full transcript), `--permission-mode acceptEdits`, an allow-list of tools (`npm run`, `npx`, `node`, `curl`, read-only `git`, the Figma MCP, the `batatabit-ds` MCP) and `--max-budget-usd`. One shot, no follow-up. This version of Claude Code has no `--max-turns`, so a run is bounded by budget and wall-clock time.

`--bare` is not used: it skips skills, `CLAUDE.md`, MCP servers and plugins, which are exactly what the rounds vary (and the Figma plugin). Without it, `claude -p` loads the project's `.mcp.json`, skills and `CLAUDE.md` like an interactive session.

## Decisions to know about

- **Clones, not `git worktree`.** Claude Code treats a worktree as part of the main repository: it loads the main repository's `.claude/skills` and uses the main project's memory folder. A smoke test showed round A listing the skill that round A had deleted. `setup.mjs` therefore makes an independent local clone of the tag (checked out detached, `origin` removed), which Claude Code treats as a separate project. A clone is functionally the same clean checkout.
- **Project history is removed from every round.** `AUDIT.md` and `PHASE5-PROPOSAL.md` hold long design-system guidance and notes about the FAQ; they are deleted in all rounds so that round A really has no guidance.
- **What stays in every round and may help the agent.** `mcp/` and the `ds:validate`, `docs:check` scripts in `package.json` still exist in round A (their guides and the MCP registration are gone), and the machine's user-level plugins and skills (for example Figma's design-to-code skill) apply to every round equally.
- **Figma server timing.** The Figma plugin server connects asynchronously and can show `pending` when a session starts. The scorer records `figmaAvailable` and the number of Figma calls per run, so a run that never reached Figma is visible in the table.
- **The Figma crops.** The reference crops in `assets/` come from the tablet frame (834px) and from `iPhone 8 - 1` (375px), anchored 40px above the FAQ heading.

## What is scored

The same scorer runs on every run (`score.mjs`), using the main tree's validator, `docs:check`, contrast and focus scripts against the run's own folder:

- Validator issues by rule on the files the agent changed or created (`mcp/src/validate-cli.ts`).
- Catalog components reused (counted on the lines the agent added) against raw HTML where a component exists.
- New components created, and whether each has a guide that passes `docs:check --only <Name>`.
- WCAG AA contrast failures and focus-ring failures at 375 and 834px (`scripts/contrast/`), `astro check` errors, warnings and hints, and whether the build succeeds.
- The FAQ itself: found on the page, in the position of the design (after the plans, before the footer), the four questions present, a question opens and closes, no horizontal overflow at 375 and 834px, and a visual difference against the Figma crop at both widths (greyscale, 4× reduced, mean absolute difference; it ranks runs, the side-by-side images are the real comparison).
- Duration, turns, tokens and cost from the run's result event, and from the transcript: Figma calls, `batatabit-ds` calls, `validate_file` calls, guides read.

Medians per round go to `results/summary.md`; every run is in `results/results.json`.

## Outputs (`results/`)

- `results.json`: every run, with its medians.
- `summary.md`: the A vs B vs C table.
- `screenshots/`: Figma | A | B | C at 834px and 375px (`side-by-side-*.png`) and the individual crops.
- `excerpts/round-*.txt`: the worst validator output of each round, a few lines each.
- `raw/<run>/`: transcript, stderr, metadata and the run's screenshots.

## If headless runs ever stop working

Run each round by hand: `node bench/setup.mjs --runs 1`, open a terminal in `../BatataBit-bench/round-a-run1`, start `claude`, paste `task.md`, let it finish without further prompts, repeat for the other rounds, then `node bench/score.mjs` (the scorer reads the working folders; durations and tokens will be missing without a transcript).
