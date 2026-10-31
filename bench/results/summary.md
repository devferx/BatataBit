# Benchmark: R0 / A / B / C × two tasks

Model `claude-sonnet-5-5` · generated 2026-10-31 18:48 UTC

## Rounds

- **R0** (`v1-astro-parity`, Figma: backup): No design system: the original Astro port (global CSS, no tokens, no components, no docs), with the original Figma file.
- **A** (`v7-ai-layer`, Figma: current): Tokens and components in code and variables in Figma, but no AGENTS.md, no docs, no component guides, no design-system MCP, no skill.
- **B** (`v7-ai-layer`, Figma: current): A plus AGENTS.md, CLAUDE.md, docs and component guides. No design-system MCP, no skill.
- **C** (`v7-ai-layer`, Figma: current): Everything: B plus the batatabit-ds MCP server and the build-section-from-figma skill.

## Tasks

- **T1**, FAQ from Figma (with the Figma link).
- **T2**, Testimonials without a design (no design, no Figma tools).

Values are the **median** across the runs of each cell; yes/no checks show how many runs passed (for example `2/3`). `n` is the number of runs per cell.

## At a glance

| | T1: validator issues · cost · duration | T2: validator issues · cost · duration |
|---|---|---|
| **R0** | 18 issues · $0.23 · 29 s (n=1) | 30 issues · $0.16 · 25 s (n=1) |
| **A** | 3 issues · $0.29 · 47 s (n=1) | 2 issues · $0.25 · 47 s (n=1) |
| **B** | 0 issues · $0.45 · 93 s (n=1) | 0 issues · $0.26 · 53 s (n=1) |
| **C** | 0 issues · $0.53 · 126 s (n=1) | 0 issues · $0.30 · 65 s (n=1) |

## T1: FAQ from Figma

| Metric | R0 | A | B | C |
|---|---|---|---|---|
| **Run quality** |||||
| Agent finished within its budget | 1/1 | 1/1 | 1/1 | 1/1 |
| Figma tool calls | 3 | 3 | 3 | 4 |
| Design-system MCP calls (batatabit-ds) | 0 | 0 | 0 | 0 |
| Guides / docs opened explicitly (AGENTS.md is auto-loaded) | 0 | 0 | 0 | 0 |
| Project skill used (build-section-from-figma) | 0/1 | 0/1 | 0/1 | 1/1 |
| Permission denials | 0 | 1 | 3 | 4 |
| **Design-system validator, on the lines the agent added** |||||
| Validator issues (total) | 18 | 3 | 0 | 0 |
| …raw colour / spacing / font / radius / shadow values | 17 | 1 | 0 | 0 |
| …raw HTML where a catalog component exists | 1 | 0 | 0 | 0 |
| **Components** |||||
| Catalog components reused (distinct) | 0 | 1 | 2 | 2 |
| Catalog component uses | 0 | 1 | 2 | 2 |
| Reuse ratio (uses / uses + raw HTML) | 0 | 1 | 1 | 1 |
| New components created | 0 | 1 | 1 | 1 |
| …with a guide | 0 | 0 | 1 | 1 |
| …whose guide passes docs:check | 0 | 0 | 1 | 1 |
| **Quality gates (only what is new against the starting state)** |||||
| WCAG AA contrast failures (375 + 834) | 8 | 0 | 0 | 0 |
| Focus-ring failures (375 + 834) | 0 | 0 | 0 | 0 |
| astro check errors | 0 | 0 | 0 | 0 |
| astro check warnings | 0 | 0 | 0 | 0 |
| astro check hints | 0 | 0 | 0 | 0 |
| Build succeeds | 1/1 | 1/1 | 1/1 | 1/1 |
| **The FAQ** |||||
| FAQ found on the page | 1/1 | 1/1 | 1/1 | 1/1 |
| In the design's position (after the plans, before the footer) | 1/1 | 1/1 | 1/1 | 1/1 |
| Questions present (of 4) | 4 | 4 | 4 | 4 |
| A question opens and closes | 0/1 | 0/1 | 1/1 | 1/1 |
| No horizontal overflow at 834px | 1/1 | 1/1 | 1/1 | 1/1 |
| No horizontal overflow at 375px | 1/1 | 1/1 | 1/1 | 1/1 |
| Visual difference vs Figma at 834px (0 = identical) | 2.64 | 1.91 | 1.96 | 2.40 |
| Visual difference vs Figma at 375px (0 = identical) | 4.45 | 3.12 | 3.12 | 3.17 |
| **Cost** |||||
| Duration (s) | 29 | 47 | 93 | 126 |
| Tokens (input + output + cache) | 255916 | 419247 | 934034 | 1485220 |
| Cost (USD, client-side estimate) | 0.23 | 0.29 | 0.45 | 0.53 |
| Turns | 14 | 20 | 29 | 42 |

### T1: validator issues by rule (median per run)

| Rule | R0 | A | B | C |
|---|---|---|---|---|
| missing-docs | 0 | 2 | 0 | 0 |
| raw-color | 1 | 0 | 0 | 0 |
| raw-font-size | 4 | 0 | 0 | 0 |
| raw-font-weight | 2 | 0 | 0 | 0 |
| raw-html-component | 1 | 0 | 0 | 0 |
| raw-line-height | 4 | 0 | 0 | 0 |
| raw-spacing | 6 | 1 | 0 | 0 |

### T1: skills the agents loaded

- R0: `figma:figma-design-to-code`
- A: `figma:figma-design-to-code`
- B: `figma:figma-design-to-code`
- C: `build-section-from-figma`, `figma:figma-design-to-code`

### T1: per run

| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | FAQ found | Diff 834 | Diff 375 | Denials | Duration (s) | Cost (USD) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| r0-t1-1 | true | 18 | 0 | 1 | 0 | 8 | 0 | true | 2.64 | 4.45 | 0 | 29 | 0.23 |
| a-t1-1 | true | 3 | 1 | 0 | 1 | 0 | 0 | true | 1.91 | 3.12 | 1 | 47 | 0.29 |
| b-t1-1 | true | 0 | 2 | 0 | 1 | 0 | 0 | true | 1.96 | 3.12 | 3 | 93 | 0.45 |
| c-t1-1 | true | 0 | 2 | 0 | 1 | 0 | 0 | true | 2.40 | 3.17 | 4 | 126 | 0.53 |

## T2: Testimonials without a design

| Metric | R0 | A | B | C |
|---|---|---|---|---|
| **Run quality** |||||
| Agent finished within its budget | 1/1 | 1/1 | 1/1 | 1/1 |
| Figma tool calls | 0 | 0 | 0 | 0 |
| Design-system MCP calls (batatabit-ds) | 0 | 0 | 0 | 0 |
| Guides / docs opened explicitly (AGENTS.md is auto-loaded) | 0 | 0 | 0 | 0 |
| Project skill used (build-section-from-figma) | 0/1 | 0/1 | 0/1 | 0/1 |
| Permission denials | 0 | 2 | 2 | 3 |
| **Design-system validator, on the lines the agent added** |||||
| Validator issues (total) | 30 | 2 | 0 | 0 |
| …raw colour / spacing / font / radius / shadow values | 29 | 0 | 0 | 0 |
| …raw HTML where a catalog component exists | 1 | 0 | 0 | 0 |
| **Components** |||||
| Catalog components reused (distinct) | 0 | 1 | 1 | 1 |
| Catalog component uses | 0 | 1 | 1 | 1 |
| Reuse ratio (uses / uses + raw HTML) | 0 | 1 | 1 | 1 |
| New components created | 0 | 1 | 1 | 1 |
| …with a guide | 0 | 0 | 1 | 1 |
| …whose guide passes docs:check | 0 | 0 | 1 | 1 |
| **Quality gates (only what is new against the starting state)** |||||
| WCAG AA contrast failures (375 + 834) | 14 | 0 | 0 | 0 |
| Focus-ring failures (375 + 834) | 0 | 0 | 0 | 0 |
| astro check errors | 0 | 0 | 0 | 0 |
| astro check warnings | 0 | 0 | 0 | 0 |
| astro check hints | 0 | 0 | 0 | 0 |
| Build succeeds | 1/1 | 1/1 | 1/1 | 1/1 |
| **The testimonials section** |||||
| Section found between the plans and the footer | 1/1 | 1/1 | 1/1 | 1/1 |
| Testimonials in it (target 3) | 3 | 3 | 3 | 3 |
| No horizontal overflow at 834px | 1/1 | 1/1 | 1/1 | 1/1 |
| No horizontal overflow at 375px | 1/1 | 1/1 | 1/1 | 1/1 |
| Colours not used anywhere else on the page (834px) | 0 | 0 | 0 | 0 |
| Font families not used anywhere else on the page (834px) | 0 | 0 | 0 | 0 |
| **Cost** |||||
| Duration (s) | 25 | 47 | 53 | 65 |
| Tokens (input + output + cache) | 181138 | 322579 | 346439 | 461183 |
| Cost (USD, client-side estimate) | 0.16 | 0.25 | 0.26 | 0.30 |
| Turns | 9 | 19 | 19 | 21 |

### T2: validator issues by rule (median per run)

| Rule | R0 | A | B | C |
|---|---|---|---|---|
| missing-docs | 0 | 2 | 0 | 0 |
| raw-color | 3 | 0 | 0 | 0 |
| raw-font-size | 6 | 0 | 0 | 0 |
| raw-font-weight | 4 | 0 | 0 | 0 |
| raw-html-component | 1 | 0 | 0 | 0 |
| raw-line-height | 4 | 0 | 0 | 0 |
| raw-radius | 1 | 0 | 0 | 0 |
| raw-shadow | 1 | 0 | 0 | 0 |
| raw-spacing | 10 | 0 | 0 | 0 |

### T2: skills the agents loaded

- R0: none
- A: none
- B: none
- C: none

### T2: per run

| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | Found | Items | Off-palette colours | Denials | Duration (s) | Cost (USD) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| r0-t2-1 | true | 30 | 0 | 1 | 0 | 14 | 0 | true | 3 | 0 | 0 | 25 | 0.16 |
| a-t2-1 | true | 2 | 1 | 0 | 1 | 0 | 0 | true | 3 | 0 | 2 | 47 | 0.25 |
| b-t2-1 | true | 0 | 1 | 0 | 1 | 0 | 0 | true | 3 | 0 | 2 | 53 | 0.26 |
| c-t2-1 | true | 0 | 1 | 0 | 1 | 0 | 0 | true | 3 | 0 | 3 | 65 | 0.30 |

## How to read this

- **Validator issues** come from the same validator for every round (`mcp/src/validate-cli.ts`), run against the v7 catalog and tokens with the agent's changed files laid on top, and only the lines the agent added are counted. R0 has no tokens or components, so its raw colours, spacings, fonts and hand-made markup count the same way as anyone else's. A new component without a guide counts as `missing-docs`.
- **Contrast, focus ring and `astro check`** count only what appears on top of the starting state of the round: the original port (R0) already has failures of its own.
- **Visual difference** (T1) is the mean absolute difference between the FAQ crop of the page and the Figma crop, both reduced 4× in greyscale (R0 is compared with the original Figma, the others with the current one): it ranks runs, it is not a pixel-perfect score. The side-by-side images are the real comparison.
- **Off-palette colours and fonts** (T2) are the colours and font families computed inside the new section that appear nowhere else on the page. It is a proxy for "matches the rest of the page", not a judgement of the design; the screenshots are.
- **Cost and tokens** come from the headless run's own result event and are client-side estimates.
- Every round has the same permissions (`bench/assets/claude-settings.json`, passed with `--settings`) and the same user-level plugins and skills; which skills each run loaded is listed per cell. Figma write tools are denied everywhere; T2 also denies every Figma tool.
