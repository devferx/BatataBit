# Batatabit design system

This page explains the rules behind the components and tokens. Read it before changing a style or adding a component. The catalog of components is in [components.md](components.md); each component has its own guide next to its code.

## Token layers

Design values live in one file, `src/tokens/tokens.json` (W3C Design Tokens format). `npm run tokens:build` turns it into `src/styles/tokens.css`, which defines every token as a CSS custom property on `:root`. Do not edit `tokens.css` by hand.

There are two layers:

- **Primitive tokens** hold raw values and carry no meaning: `color.orange.500`, `font.size.14`, `space.16`, `radius.8`. They are the palette.
- **Semantic tokens** are aliases of primitives that say what a value is for: `color.primary`, `color.text-muted`, `radius.card`, `shadow.on-light`. Each has a `$description` that states when to use it.

**The rule: components and page styles consume semantic tokens only.** Never use a primitive, a raw hex colour, a raw pixel spacing or a raw font size in a component. If no semantic token fits, add one to `tokens.json` with a description; do not write the value in CSS.

CSS names are the token path joined with dashes: `color.text-muted` is `var(--color-text-muted)`, `space.16` is `var(--space-16)`. Typography tokens expand to `-family`, `-size`, `-weight` and `-line` (and `-letter-spacing` when set): `text.button` gives `--text-button-size` and the others.

## Typography

- **Inter** (`font.data`) is for data, numbers and small labels: table cells, prices, notes, chips and badges.
- **DM Sans** (`font.body`) is for headings and running text, including table titles.

| Style | Font | Size / line | Use |
|---|---|---|---|
| `text.heading-lg` | DM Sans bold | 24/26, 40/42 from 768px | Page and section headings. |
| `text.lead` | DM Sans medium | 14/18, 20/24 from 768px | Lead paragraph under a heading; footer links. |
| `text.body-sm` | DM Sans medium | 14/18 | Card body text, plan titles. |
| `text.button` | DM Sans bold | 14/18 | Button labels. |
| `text.title-md` | DM Sans bold | 18/23 | Table titles. |
| `text.title-sm` | DM Sans bold | 18/18 | Feature card titles. |
| `text.data-label` | Inter medium | 16/19, -2% tracking | First column of a table. |
| `text.data-value` | Inter regular | 16/19, -2% tracking | Value column of a table. |
| `text.caption` | Inter regular | 12/15 | Chips. |
| `text.note` | Inter medium | 12/15 | Notes under a price, the currency symbol. |
| `text.badge` | Inter bold | 12/15 | Solid badges, the bold word in a chip. |
| `text.price` | Inter bold | 52/53 | Plan price. |

## The 62.5% root font size

`html { font-size: 62.5% }` makes 1rem equal 10px at the browser's default size, so rem values read as pixels divided by ten: `1.4rem` is 14px, `5.2rem` is 52px. Every font-size and line-height token is written in rem on this basis. Consequences:

- Write sizes in rem (through tokens), never in px, so they still follow the user's browser font-size setting.
- Do not change the root percentage without recalculating every `font.size.*` and `font.line-height.*` value.
- The root rule is the only raw design value left in the CSS.

## Spacing and layout

- **Spacing** follows a 4px scale: `space.4`, `space.8`, `space.12`, `space.16`, `space.20`, `space.24`, `space.32`, `space.40`, `space.48`, `space.64`, `space.80`. Margins, paddings and gaps use these tokens. If a design value is not on the scale, report it; do not add a raw value.
- **Layout tokens** hold page-level values that are not spacing. Several switch at the tablet breakpoint:

| Token | Mobile | From 768px | Meaning |
|---|---|---|---|
| `layout.hero-min-height` | 334px | 480px | Minimum height of the hero. |
| `layout.hero-padding-top` | 48px | 64px | Space above the hero logo block. |
| `layout.hero-logo-margin-top` | 8px | 40px | Space between that padding and the logo. |
| `layout.hero-logo-width` | 150px | 174px | Width of the hero logo. |
| `layout.title-measure` | 100% | 466px | Maximum width of a section title block. |
| `layout.footer-min-height` | 150px | 271px | Minimum height of the footer. |
| `layout.content-max-width` | 930px | 930px | Maximum width of multi-column content. |

## Breakpoint

There is one breakpoint, `breakpoint.tablet`: **768px**. Below it the page uses the mobile values; from it, the tablet values.

- The paired tokens (`mobile` and `tablet` values) switch automatically: `tokens.css` reassigns the base variables inside one `@media (min-width: 768px)` block. Components never choose between them.
- Custom properties cannot be used inside `@media`, so the value 768px is written literally in `tokens.css` (generated from the token) and in the few component and page stylesheets that need a tablet layout.

## Keyboard focus

Every focusable element (links, buttons, anything with `tabindex`) gets the same ring from one global `:focus-visible` rule: `color.focus-ring`, `focus.ring-width` (2px) and `focus.ring-offset` (4px). The dark ring keeps at least 3:1 against every surface that holds a focusable element: white, off-white, the orange footer and the hero gradient (3.08:1 at worst, on the hero button). Never remove it with `outline: none`; if a new surface needs a different ring, change the token.

## Source of truth

- **Design decisions** (colours, type, spacing, radii, layout) follow Figma. Figma styles and variables use the same names as the tokens. When code and Figma disagree on a value, Figma wins.
- **Content** (copy, prices, labels, table rows) follows the code, in `src/data/*.json` and the page. Figma text is updated to match.
- **Unbound Figma values are drift.** A colour, size or spacing in Figma that is not bound to a variable or style is not a design decision; rebind it to the nearest token instead of copying the raw value.

## Documented exceptions

- **Hero lead contrast.** The hero lead uses `color.primary-soft` over `gradient.hero`. Measured on the rendered gradient it is **3.03:1 at worst** (at a 320px viewport), below the 4.5:1 that WCAG AA asks for body text. This is a deliberate brand decision: the soft orange over the dark-to-orange gradient is the brand look. Because of it, no other text may be placed on `gradient.hero`; only the lead of `SectionTitle` with `tone="on-gradient"` sits there.
- Text on photos is not an exception: use `gradient.image-scrim` above the photo so white text keeps 3:1 or better.

## Checking your work

- `npm run tokens:build` regenerates the CSS tokens.
- `npm run docs:check` verifies that every component guide matches its code and that every token named in the docs exists.
- `npx astro check` type-checks the project.
- `node scripts/contrast/focus-ring.mjs <url>` tabs through every focusable element and measures its ring against the surroundings.
- `node scripts/contrast/audit-page.mjs <url>` audits text and UI contrast on the rendered page; `node scripts/contrast/hero-contrast.mjs <url> --live` measures the hero over the real gradient.
