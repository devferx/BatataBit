---
name: build-section-from-figma
description: Build or update a page section of the Batatabit site from a Figma frame using only the existing components and design tokens. Use when the user shares a Figma link or node and asks to implement, add, update or match a section, screen or component in code.
---

# Build a section from Figma

Turn a Figma frame into a section made of catalog components and semantic tokens. Follow the steps in order. The rules behind them are in `AGENTS.md`: Figma wins for design, `src/data` wins for content, and unbound Figma values are drift.

Tools: the Figma MCP tools (`get_design_context`, `get_variable_defs`, `get_screenshot`, plus `get_metadata` to find nodes) and the `batatabit-ds` MCP tools (`list_components`, `get_component`, `get_tokens`, `resolve_value`, `validate_file`).

## 1. Read the Figma frame

1. Get the `fileKey` and `nodeId` from the URL (`node-id=12-34` means `12:34`).
2. Call `get_design_context` for the frame (or `get_metadata` first to find the section's node), `get_variable_defs` for its variables and styles, and `get_screenshot` for the visual target. For very tall frames, screenshot one section at a time.
3. Treat the generated code as a reference only. Note which values come from Figma variables or styles (bound) and which are raw (unbound).

## 2. Map every value to tokens

For each colour, size, spacing, radius, shadow and font weight or family read from Figma, call `resolve_value`.

- **Exact match:** use the semantic token whose description fits the role (several tokens can share a value, for example `color.surface-page` and `color.surface-button`).
- **Near match (drift):** an unbound value close to a token is drift. Use the nearest token; do not copy the raw value.
- **No match or off-scale:** for example 15px against the 4px scale. Use the nearest token only if the difference is small, and list the value in your final report. Never add a raw value.
- Typography: pick one `text.*` style per text layer (size, weight and line height come together). Use `get_tokens` with `category: "text"` to see them.

## 3. Pick components

1. Call `list_components`, then `get_component` for every candidate and read its "When to use" and "When NOT to use".
2. Match each Figma element to a component and its props (variants are union types such as `tone`). Do not hand-write markup a component already provides.
3. If nothing fits, stop and follow "If no component fits" in `AGENTS.md`: create a documented component before using it.

## 4. Put the content in `src/data`

1. Add or extend a JSON file in `src/data/` with the copy, prices and rows, in Spanish, as the code states it (when Figma and code differ on content, the code wins; report the difference).
2. Type it with the matching `Props` in `src/data/index.ts`, and render lists with `.map()`.

## 5. Compose the section

Edit `src/pages/index.astro` using the components. Page-level layout (container widths, margins, section padding) goes in `src/styles/global.css` or a scoped style, using `space.*` and `layout.*` tokens only. Add nothing that Figma does not show.

## 6. Validate and fix

1. Call `validate_file` on every file you created or changed. Fix each issue using its suggestion and run it again until it reports 0 issues.
2. Run `npm run ds:validate`, `npx astro check` (0 errors, 0 warnings, 0 hints) and `npm run docs:check`.

## 7. Compare with Figma

1. Build and capture screenshots at 375 and 834px with `node tests/visual/capture.mjs <url> <folder> 375,834`.
2. Compare them with the Figma screenshot at the same width. List every visible difference (position, size, colour, text).
3. Run `node scripts/contrast/audit-page.mjs <url>` and `node scripts/contrast/focus-ring.mjs <url>`: 0 failures expected.

## 8. Report

Summarise: components used and their props, the tokens chosen, drift you mapped (raw value to token), off-scale or unmatched values, content that differed from Figma, and the remaining visual differences.
