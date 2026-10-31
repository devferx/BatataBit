# Batatabit: agent guide

Batatabit is a single-page landing site (Spanish content) built with a small design system. It is meant to be extended by people and AI agents without breaking it. Read this file, then the docs it points to.

## Stack and commands

Astro 5 (static), strict TypeScript, scoped component CSS, no client JavaScript. Node 22.18 or newer.

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Dev server / production build. |
| `npx astro check` | Type-check Astro and TypeScript. Must show 0 errors, 0 warnings, 0 hints. |
| `npm run tokens:build` | Regenerate `src/styles/tokens.css` from `src/tokens/tokens.json`. |
| `npm run docs:check` | Fail if a component guide drifts from its Props or cites an unknown token. |
| `npm run ds:validate` | Design-system validator over the whole site (same engine as the MCP `validate_file` tool). |
| `npm run mcp:test` / `npm run mcp:typecheck` | Tests and type-check of the MCP server in `mcp/`. |

## Where things live

- `src/components/<Name>/<Name>.astro` and `<Name>.md`: one folder per component, with its guide.
- `docs/components.md`: the component catalog. `docs/design-system.md`: the rules behind it.
- `src/tokens/tokens.json`: the only source of design values. `src/styles/tokens.css` is generated; never edit it.
- `src/data/*.json` (typed in `src/data/index.ts`): the content. `src/pages/index.astro`: the page.
- `src/styles/global.css`: reset, base styles and page-level layout only.
- `mcp/`: the `batatabit-ds` MCP server. `tests/fixtures/bad-section.astro`: an intentionally wrong section used to demo the validator.

## Rules

1. **Reuse before writing markup.** Open `docs/components.md` first; read the guide of any component you might use (When to use / When NOT to use). Do not hand-write buttons, tables, cards, headings or icons that a component already provides.
2. **Semantic tokens only.** Use `var(--color-primary)`, `var(--space-16)`, `var(--text-button-size)` and friends. Never write raw colours (hex, rgb), raw spacing, raw font sizes, radii, shadows or font families. Never use primitive tokens (`--color-orange-500`, `--radius-8`) in components; spacing is the one category that uses `--space-*` directly.
3. **Typography.** Inter for data, numbers and small labels; DM Sans for headings and running text. Set size, weight and line height together through a `text.*` style. The root is `62.5%`, so `1rem` is 10px.
4. **Spacing and layout.** 4px scale (`space.4` to `space.80`). Page-level values come from `layout.*` tokens. If a design value is not on the scale, report it; do not add a raw value.
5. **One breakpoint: 768px.** Mobile and tablet typography and layout tokens switch automatically; do not choose between them in components.
6. **Source of truth.** Design decisions (colours, type, spacing, radii, layout) follow Figma, where styles and variables carry the token names. Content follows the code: copy, prices and table rows live in `src/data` and Figma is updated to match. A Figma value that is not bound to a variable or style is drift: map it to the nearest token (the `resolve_value` tool does this) instead of copying it.
7. **Accessibility.**
   - Use semantic HTML and a single `h1` with an ordered outline.
   - Meet WCAG 2.2 AA contrast (4.5:1 text, 3:1 large text and UI). The hero lead on the gradient is the one documented exception: put no other text on `gradient.hero`.
   - Keep the global focus ring; never use `outline: none`.
   - Give every meaningful icon a text alternative, and never rely on colour alone.
   - Buttons that share a label need distinct accessible names.
8. **Content language is Spanish; code, docs and comments are English.** The product is spelled "Batatabit".

## If no component fits

Create one, following the existing ones:

1. Folder `src/components/<Name>/` with `<Name>.astro` and `<Name>.md`.
2. An exported `Props` interface with a JSDoc comment on every prop (what it does, allowed values, `@default`). Use union types for variants, never free strings. No `class` or `style` override props.
3. Scoped styles that consume semantic tokens only.
4. A guide with the nine sections in order: Purpose, When to use, When NOT to use, Props, Variants, Tokens used, Accessibility, Examples, Do / Don't.
5. A one-line entry in `docs/components.md`, then `npm run docs:check`.

If a value is missing from the tokens, add a semantic token with a `$description` that says when to use it, then run `npm run tokens:build`.

## Definition of done

All of these pass: `npx astro check` (0 errors, 0 warnings, 0 hints), `npm run docs:check`, and the design-system validator (`npm run ds:validate`, or the `validate_file` tool on every file you changed). For visual work, also run `node scripts/contrast/audit-page.mjs <url>` and compare screenshots with Figma.

## MCP server

When an MCP server named `batatabit-ds` is available, use it (it is registered in `.mcp.json`):

- `list_components` / `get_component`: find the right component and read its props and guide before writing markup.
- `get_tokens` / `resolve_value`: look up tokens, and map any raw value from Figma or CSS to tokens.
- `validate_file`: run it on every `.astro` or `.css` file you write or change, and fix each issue it reports.

The `build-section-from-figma` skill in `.claude/skills/` chains these steps for turning a Figma frame into a section.
