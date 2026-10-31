# Benchmark: implement the FAQ section from Figma

Base: tag `v7-ai-layer` · model `claude-sonnet-5-5` · generated 2026-10-31 15:33 UTC

Task (identical in every run): *Implement the FAQ section from the Figma "Tablet ≥768" frame and add it to the landing page in the position it has in the design. It must work on mobile and tablet.*

- **Round A** (1 run): Figma MCP only. No AGENTS.md, no docs, no component guides, no design-system MCP, no skill.
- **Round B** (1 run): AGENTS.md, CLAUDE.md, docs and component guides. No design-system MCP, no skill.
- **Round C** (1 run): Everything: AGENTS.md, docs, component guides, the batatabit-ds MCP server and the build-section-from-figma skill.

Values are the **median** across runs of each round; yes/no checks show how many runs passed (for example `2/3`).

| Metric | A | B | C |
|---|---|---|---|
| **Run quality** ||||
| Agent finished within its budget | 1/1 | 1/1 | 1/1 |
| Figma MCP available in the session | 1/1 | 1/1 | 1/1 |
| Figma tool calls | 7 | 7 | 9 |
| Design-system MCP calls (batatabit-ds) | 0 | 0 | 4 |
| …of which validate_file | 0 | 0 | 0 |
| Guides / docs opened explicitly (AGENTS.md is auto-loaded) | 0 | 0 | 0 |
| Project skill used (build-section-from-figma) | 0/1 | 0/1 | 1/1 |
| **Design-system validator issues on changed files** ||||
| Validator issues (total) | 2 | 0 | 0 |
| **Components** ||||
| Catalog components reused (distinct) | 2 | 2 | 2 |
| Catalog component uses | 2 | 2 | 2 |
| Raw HTML where a component exists | 0 | 0 | 0 |
| Reuse ratio (uses / uses + raw HTML) | 1 | 1 | 1 |
| New components created | 1 | 1 | 1 |
| …with a guide | 0 | 1 | 1 |
| …whose guide passes docs:check | 0 | 1 | 1 |
| **Quality gates** ||||
| WCAG AA contrast failures (375 + 834) | 0 | 0 | 0 |
| Focus-ring failures (375 + 834) | 0 | 0 | 0 |
| astro check errors | 0 | 0 | 0 |
| astro check warnings | 0 | 0 | 0 |
| astro check hints | 0 | 0 | 0 |
| Build succeeds | 1/1 | 1/1 | 1/1 |
| **The feature** ||||
| FAQ found on the page | 1/1 | 1/1 | 1/1 |
| In the design's position (after the plans, before the footer) | 1/1 | 1/1 | 1/1 |
| Questions present (of 4) | 4 | 4 | 4 |
| A question opens and closes | 1/1 | 1/1 | 1/1 |
| No horizontal overflow at 834px | 1/1 | 1/1 | 1/1 |
| No horizontal overflow at 375px | 1/1 | 1/1 | 1/1 |
| Visual difference vs Figma at 834px (0 = identical) | 3.17 | 2.40 | 2.39 |
| Visual difference vs Figma at 375px (0 = identical) | 4.22 | 3.14 | 4.78 |
| **Cost** ||||
| Duration (s) | 89 | 117 | 113 |
| Tokens (input + output + cache) | 822302 | 894654 | 1244571 |
| Cost (USD, client-side estimate) | 0.34 | 0.38 | 0.48 |
| Turns | 30 | 33 | 47 |

### Validator issues by rule (median per run)

| Rule | A | B | C |
|---|---|---|---|
| missing-docs | 2 | 0 | 0 |

### Per run

| Run | Finished | Issues | Reused | Raw HTML | New components | Contrast fails | astro errors | FAQ found | Diff 834 | Diff 375 | Duration (s) | Cost (USD) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a-1 | true | 2 | 2 | 0 | 1 | 0 | 0 | true | 3.17 | 4.22 | 89 | 0.34 |
| b-1 | true | 0 | 2 | 0 | 1 | 0 | 0 | true | 2.40 | 3.14 | 117 | 0.38 |
| c-1 | true | 0 | 2 | 0 | 1 | 0 | 0 | true | 2.39 | 4.78 | 113 | 0.48 |

### How to read this

- **Validator issues** are counted by the same validator for every round (`mcp/src/validate-cli.ts`), on the files the agent changed or created, against the tokens and component list of that run. A new component without a guide always counts as `missing-docs`, so round A, which has no guides to imitate, starts with that handicap by design.
- **Visual difference** is the mean absolute difference between the FAQ crop of the page and the Figma crop, both reduced 4× in greyscale: it ranks runs, it is not a pixel-perfect score. The side-by-side images are the real comparison.
- **Cost and tokens** come from the headless run's own result event and are client-side estimates.
- Every round also has the user-level plugins and skills of the machine (for example Figma's own design-to-code skill); they are identical across rounds.
