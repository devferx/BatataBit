# Login page: before and after the design system

The same one-shot request, the same model (`claude-sonnet-5-5`) and the same permissions, in two independent one-commit clones. Figma tools are denied in both: the login is not in Figma.

> Create a login page at /login with email and password fields, a "¿Olvidaste tu contraseña?" link, and a submit button labeled "Ingresar". It must match the rest of the site and work on mobile and tablet.

- **Before** (`feat/login-before-design-tokens`): tag `v1-astro-parity`. Astro with one global CSS: no tokens, no components, no docs, no AGENTS.md, no MCP, no skill.
- **After** (`feat/login`): current `main`. Tokens, seven components with guides, AGENTS.md, the `batatabit-ds` MCP server and the `build-section-from-figma` skill (`bench/`, `AUDIT.md` and `PHASE5-PROPOSAL.md` removed so no process notes leak).

One run per side, so this is an illustration, not a statistic.

| Metric | Before (`feat/login-before-design-tokens`) | After (`feat/login`) |
|---|---|---|
| **Design-system validator** (lines the agent added, against the current catalog and tokens) |||
| Validator issues (total) | 48 | 0 |
| …raw-border-width | 2 | 0 |
| …raw-color | 6 | 0 |
| …raw-font-family | 2 | 0 |
| …raw-font-size | 6 | 0 |
| …raw-font-weight | 5 | 0 |
| …raw-html-component | 2 | 0 |
| …raw-line-height | 3 | 0 |
| …raw-radius | 3 | 0 |
| …raw-shadow | 2 | 0 |
| …raw-spacing | 17 | 0 |
| Raw colour, spacing, font, radius and shadow values | 46 | 0 |
| **Components** |||
| Catalog components reused | 0 (none) | 2 (Button×1, SectionTitle×1) |
| Hand-made markup where a catalog component exists | 2 | 0 |
| New components created | 0 | 1 (TextField) |
| …with a guide that passes `docs:check` | 0 of 0 | 1 of 1 |
| **Accessibility and quality** (rendered /login) |||
| New WCAG AA contrast failures (375 + 834) | 0 | 0 |
| Focus-visibility failures on /login (375 + 834) | 6 | 2 |
| Every input has a label (programmatic) | yes | yes |
| …and the label is visible | yes | yes |
| Email input has `type="email"` | yes | yes |
| Email `autocomplete` is `email` or `username` | yes | yes |
| Password `autocomplete="current-password"` | yes | yes |
| Submit is a real `<button type="submit">` inside the form | yes | yes |
| Submit label is exactly “Ingresar” | yes | yes |
| “¿Olvidaste tu contraseña?” is a link with an `href` | yes | yes |
| Fields marked `required` | yes | yes |
| The heading is actually visible (not covered by another element) | no | yes |
| Fields, link and button are not covered by anything | yes | yes |
| `h1` count (should be 1) | 1 | 1 |
| Smallest tap target on the page, px (field, button, link) | 26 | 26 |
| No horizontal overflow at 375px / 834px | yes / yes | yes / yes |
| `astro check` errors (new) | 0 | 0 |
| Build succeeds | yes | yes |
| **The run** |||
| Duration (s) | 45 | 200 |
| Cost (USD, client-side estimate) | 0.21 | 0.43 |
| Turns | 12 | 30 |
| Permission denials | 2 | 4 |
| `batatabit-ds` MCP calls | 0 | 0 |
| Skills loaded | none | none |
| Files changed or added | `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `src/pages/login.astro` | `docs/components.md`, `src/components/Button/Button.astro`, `src/components/Button/Button.md`, `src/layouts/BaseLayout.astro`, `src/styles/tokens.css`, `src/tokens/tokens.json`, `src/components/TextField/TextField.astro`, `src/components/TextField/TextField.md`, `src/pages/login.astro` |

## How it was measured

- The validator (`mcp/src/validate-cli.ts`) runs against the catalog and tokens of the current `main` with the agent's files laid on top, and counts only issues on lines the agent added. The "before" project has no tokens, so every raw value there counts against it.
- New contrast failures are the ones that did not exist on the starting site's home page; focus-visibility failures are counted on `/login` itself.
- Accessibility checks run in a real browser on the built page (`bench/lib/render.mjs`).
- Screenshots: `screenshots/`. Code excerpts: `excerpts/`. Full transcripts: `transcripts/`. Raw scorer output: `results.json`.
