# BatataBit — Design System Audit (read-only evaluation)

Audit date: 2026-10-30 · Scope: `index.html` (183 lines), `styles.css` (545), `css/tablet.css` (15), `assets/` (17 files), `.prettierrc`.
No files other than this report were touched. Line numbers refer to the current `main` (43021e9).

> **Caveat on Figma:** I only have the *names* of the Figma styles, not their values. Every "Figma ↔ code" mapping below is inferred from names and from what the code uses. Rows marked **(assumed)** need confirmation against Figma.

---

## 1. Executive summary

- **There is no build setup, no dependencies, no JS.** Two HTML/CSS entry points, one Prettier config (`{}`), 28 commits. The Astro migration is low-risk: nothing needs bundler-level porting.
- **The "informal design system" is only ~40% tokenized.** Colors are the best part: 9 custom properties, used 29× via `var()`. But 2 more greys (`#757575` ×5, `#808080` ×2), the header gradient, 3 shadows, and `#faf8f7` (line 495, duplicate of `--off-white`) are hardcoded. **Zero** tokens exist for typography, spacing, radius, shadow, or breakpoints.
- **Typography is the biggest gap vs. Figma.** Figma defines 4 text styles; the code uses **12 distinct size/line-height pairs**, and the two *Tablet+* styles (40/42, 20/24) **do not exist in code at all** — `css/tablet.css` only changes layout widths. Also, Figma's "H2" (14/18) is applied to `<p>` elements while the HTML `<h2>` uses the "H1 Mobile" style, so names will mislead an AI reading both.
- **Naming drift between code and Figma:** `--black` (#282623) is presumably Figma's "Warm Black+1"; there is no `--linear-bg`; "Sombra" has **two** variants in code (warm-tinted vs. pure black); `--just-white`/`--off-white`/`--grey`/`--soft-*` already match.
- **Component duplication is high but consistent:** 5 section-title blocks, 4 identical feature cards, 3 identical plan cards, 2 identical currency tables, 4 buttons/CTA variants — all copy-pasted markup with *per-section* class names (`.plans--title h2`, `.product-detail--title h2`, …) that re-declare the same heading rules 5×.
- **Accessibility has real failures:** 8 text/background pairs fail WCAG AA (worst: `#bababa` on white = **1.94:1**, white on orange = **2.3:1**, white on blue = **3.0:1**); `<title>` is "Document"; logo `alt=""` on a meaningful brand image; icons conveyed by CSS backgrounds with no text alternative (trend up/down is color+icon only); the horizontal slider is not keyboard-reachable by design; no `:focus-visible` styles anywhere.
- **Font loading bug:** Google Fonts requests DM Sans `400,500, italic 700` and Inter `300,500`, but CSS uses **non-italic bold (700)** and Inter **400/700** → browser synthesizes faux-bold / substitutes weights (`index.html:9`).
- **Responsive strategy is fragile:** a single breakpoint (930px) implemented as a `media` attribute on a `<link>` (`index.html:13`), fixed `930px` widths, absolute-positioned button with magic numbers (`styles.css:86–88`), no `@media` inside the stylesheet. For the demo, this is both a risk (Tablet+ type styles must be *added*) and a great before/after story.

---

## 2. Project structure

| Item | Finding |
|---|---|
| Entry | `index.html` only (single page) |
| CSS | `styles.css` (base + all components, 545 lines) + `css/tablet.css` (15 lines, loaded with `media="(min-width: 930px)"`, `index.html:13`) |
| Build / package manager | None. No `package.json`, no lockfile, no bundler. `.prettierrc` is `{}` (defaults) with no Prettier installed |
| JavaScript | **None** in the project |
| Fonts | Google Fonts `<link>` (`index.html:7–11`): DM Sans, Inter |
| Docs / tests / lint / CI | None (no README, no stylelint/eslint, no CI) |
| Assets | `assets/icons/` 10 SVG; `assets/img/` 7 files (3.0 MB total; two are heavy raster images) |

**Assets observations**

| File | Status |
|---|---|
| `img/bitcoinbaby2x.jpg` (481 KB) | Used (`styles.css:378`, note double slash `assets//img`) |
| `img/bitcoinbaby.jpg`, `bitcoinbaby.png`, `bitcoinbaby2x.png` (134/184/690 KB) | **Unreferenced** — 1 MB of dead weight; no `image-set`/`srcset` is using the 1x/2x pair |
| `icons/right-arrow.svg` | **Unreferenced** (`orange-right-arrow.svg` is the one used, `styles.css:510`) |
| `img/Bitcoin.svg` (58 KB), `logo.svg`, `logo-footer.svg` | Used |
| Icons `check-circle, clock, dollar-sign, eye, orange-right-arrow` | Stroke `#F7931A` **hardcoded inside SVG** (duplicates `--bitcoin-orange`, can't be themed) |
| `icons/trending-down.svg` / `trending-up.svg` | Hardcoded `#F5450D` / `#07D635` — **semantic colors (danger/success) that appear nowhere in CSS tokens or Figma list** |
| `icons/batata.svg` | Hardcoded `#FFC250/#FFD064/#FFE19D` (illustration colors, not in token list) |
| `icons/down-arrow.svg` | Hardcoded `#201E1C` (= `--warm-black`) |

**Other hygiene:** `html` rule declared twice (`styles.css:28` and `:37`); `body` margin/padding reset is redundant with the `*` reset (`:22–35`); typo "Babtabit" (`index.html:114`), product spelled "Batabit" in body and "Batatabit" in footer alt; `<title>Document</title>` (`:6`); footer links are all `href="#"` (`:173–175`).

---

## 3. Design token inventory

Counts are occurrences in `styles.css` unless stated.

### 3.1 Colors

| Value | Figma name (inferred) | Defined as var? | Uses via `var()` | Hardcoded uses (line) | Notes |
|---|---|---|---|---|---|
| `#f7931a` | Bitcoin Orange | `--bitcoin-orange` | 4 | in gradient (51) | + hardcoded in 5 SVG icons |
| `#ffe9d5` | Soft Orange | `--soft-orange` | 2 | — | |
| `#1a9af7` | Secondary Blue | `--secondary-blue` | 2 | — | |
| `#e7f5ff` | Soft Blue | `--soft-blue` | 1 | — | |
| `#201e1c` | Warm Black | `--warm-black` | 2 | in gradient (51) | |
| `#282623` | Warm Black+1 **(assumed)** | `--black` ⚠ name differs | 7 | — | |
| `#bababa` | Grey **(assumed)** | `--grey` | 1 | — | Fails contrast (see §7) |
| `#faf8f7` | Off White | `--off-white` | 2 | **495** (`#faf8f7` literal) | duplicate of token |
| `#fff` | Just White | `--just-white` | 8 | — | |
| `#757575` | — **not in Figma list** | ❌ | 0 | 157, 211, 236, 421, 488 (**×5**) | Body-copy grey; should be a token |
| `#808080` | — **not in Figma list** | ❌ | 0 | 318, 371 (**×2**) | Dark-section body grey |
| `rgba(89,73,30,.16)` | part of "Sombra" | ❌ | 0 | 96, 444 (×2) | warm shadow |
| `rgba(0,0,0,.16)` | part of "Sombra"? | ❌ | 0 | 330 | dark-surface shadow |
| `linear-gradient(207.8deg, #201e1c 16.69%, #f7931a 100%)` | Linear BG | ❌ | 0 | 51 | only gradient; hardcodes two token values |
| `#f5450d`, `#07d635` | — **not in Figma list** | ❌ | — | in SVGs only | danger / success semantics |

**Near-duplicates:** `#757575` vs `#808080` (two "mid greys" differing by only 11 in each channel — consolidate to one or make them intentional: *text-muted-on-light* / *text-muted-on-dark*); `#faf8f7` literal vs `--off-white`; `--black` (`#282623`) vs `--warm-black` (`#201e1c`) are intentionally different but badly named (`--black` is not black). No `#F7931A/#F7941B`-style drift exists in colors.

### 3.2 Typography

**Font families:** `"DM Sans", sans-serif` (set on `html`, `:38`; re-declared on `.plan-card--ca`, `:501` because buttons don't inherit) ×2 · `"Inter", sans-serif` ×1 (`.main-currency-table`, `:167`).
**Root:** `html { font-size: 62.5% }` (`:38`) → 1rem = 10px. All sizes are rem on this basis (good for scaling, but a common AI/dev footgun — document it).

| Size / line-height (px) | Uses | Where | Figma match |
|---|---|---|---|
| **24 / 26** | 5 | h1 (71) + h2 ×4 (146, 306, 385, 409) | ✅ **H1 Mobile** |
| **14 / 18** | 8 (+1 at 14/18 in `.plan-card--title`) | subtitle `p`s (79, 313, 367, 416), button (98 no LH), plan title (466) | ✅ **H2 Mobile** (but applied to `<p>`) |
| 14 / 16 | 1 | `.main-exchange-container p` (154) | ❌ near-dup of 14/18 |
| 14 / 17 | 1 | `.table__right` (233) — **dead rule** | ❌ |
| 18 / 23 | 1 | `.currency-table--title` (172) | ❌ |
| 18 / 18 | 1 | `.product--card-title` (361) | ❌ (LH = font-size, tight) |
| 16 / 19 | 1 | table cells (202) | ❌ |
| 12 / 15 | 1 | `.currency-table--date p` (272) | ❌ |
| 12 / — (inherit) | 3 | `.recommended` (454), `.plan-card--price span` (481), `.plan-card--saving` (487) | ❌ no line-height set |
| 52 / 53 | 1 | `.plan-card--price` (474) | ❌ |
| **40 / 42** | 0 | — | ❌ **H1 Tablet+ missing in code** |
| **20 / 24** | 0 | — | ❌ **H2 Tablet+ missing in code** |

**Near-duplicates flagged:** line-height 18 vs 16 vs 17 for the same 14px; 18/18 vs 18/23 for the same 18px.

**Font weights:** `bold` ×10, `500` ×7, `normal` ×2, `300` ×2. Mixed keywords and numbers (`bold` vs `500`). Weights **loaded** vs **used** mismatch:

| Family | Loaded (`index.html:9`) | Used in CSS | Problem |
|---|---|---|---|
| DM Sans | 400, 500, *italic 700* | 400 (inherit), 500, **700 (non-italic)** | 700 upright is **not loaded** → synthesized bold |
| Inter | 300, 500 | 300 (`:273`), **400** (`:203`), **700** (`:173`) | 400 and 700 **not loaded** → synthesized/substituted |

### 3.3 Spacing (margin / padding / gap / offsets, px)

No spacing tokens. Approximate usage counts across `margin`, `padding`, `gap`, and `top/left` offsets:

| Value | ≈Uses | | Value | ≈Uses | | Value | ≈Uses |
|---|---|---|---|---|---|---|---|
| 2 | 1 (gap) | | 15 | 7 | | 40 | 1 |
| 5 | 3 | | 16 | 1 | | 50 | 5 |
| 6 | 1 | | 20 | 5 | | 60 | 2 |
| 8 | 1 | | 25 | 1 | | 70 | 1 |
| 10 | 7 | | 30 | 7 | | 80 | 1 |
| 12 | 1 | | 35 | 1 | | | |

Scale is *roughly* 5/10/15/20/30/50 with outliers (**6, 8, 12, 16, 25, 35, 40, 60, 70, 80**). Near-duplicate: **15 vs 16** (`:171`, `:261`). Recommended 4/8-based scale will need ~6 values to be snapped (see §8).

**Magic sizes (width/height):** `288px`×5 (min-width), `320px`×4, `150px`×4, `334px` (header height), `316px` (slider height), `250px`×2, `229px` (button width), `190px`×2, `930px` (tablet.css ×2). Mostly fixed `height`s on content boxes: `header` 334 (`:49`), `.header--title-container` 218 (`:65`), grid 250 (`:192`), plan card 250 (`:439`) — content-dependent heights that will clip with longer copy or text zoom.

### 3.4 Border radius

| Value | Uses | Where |
|---|---|---|
| 4px | 1 | plan CTA (497) |
| 5px | 2 | header button (97), feature card (329) |
| 8px | 2 | date chip (264), badge (456) |
| 15px | 2 + 4 corner variants | grid (194), plan card (443), per-corner rules (215–229) |

Near-duplicates: **4 vs 5px** (CTA vs header button — same visual role "button"). Per-corner radii (`:214–230`) hack a rounded 2×N grid with 4 modifier classes.

### 3.5 Shadows

| Value | Uses | Lines | Figma |
|---|---|---|---|
| `0px 4px 8px rgba(89,73,30,.16)` | 2 | 96, 444 (one with `0px`, one with `0` — inconsistent literal) | "Sombra" ✅ (assumed) |
| `0 4px 8px rgba(0,0,0,.16)` | 1 | 330 | ❌ second variant; Figma has only one "Sombra" |

### 3.6 Breakpoints, z-index

| Item | Finding |
|---|---|
| Breakpoints | **One**: `min-width: 930px` (via `<link media>`, `index.html:13`). **No `@media` rules** in either CSS file. Also implicit fixed widths of 930px |
| `min-width` floors | 320px (×4) / 288px (×5) / 235 / 230 — implicit "mobile floor" |
| z-index | **None used.** Stacking relies on DOM order + `position:absolute` (`:43, 86, 279, 288, 434, 448`) |
| Other | `scroll-behavior: smooth` (`:29`) with no `prefers-reduced-motion` guard |

---

## 4. Figma vs. code

| Figma style | Code equivalent | Status |
|---|---|---|
| **Text: H1 Mobile (24/26)** | `font-size:2.4rem; line-height:2.6rem; bold` — 5× (h1 + 4 h2) | ✅ matches; but also used for `<h2>` |
| **Text: H2 Mobile (14/18)** | `1.4rem/1.8rem` on subtitle `<p>` | ✅ values match; ⚠ semantic name wrong (it's a subtitle/lead, not an h2) |
| **Text: H1 Tablet+ (40/42)** | — | ❌ **missing in code** |
| **Text: H2 Tablet+ (20/24)** | — | ❌ **missing in code** |
| Color: Bitcoin Orange | `--bitcoin-orange` | ✅ |
| Color: Soft Orange | `--soft-orange` | ✅ |
| Color: Secondary Blue | `--secondary-blue` | ✅ |
| Color: Soft Blue | `--soft-blue` | ✅ |
| Color: Warm Black | `--warm-black` | ✅ |
| Color: Warm Black+1 | `--black` (#282623) | ⚠ name mismatch **(assumed)** |
| Color: Grey | `--grey` | ✅ name; ⚠ value fails contrast as text |
| Color: Off White | `--off-white` | ✅ |
| Color: Just White | `--just-white` | ✅ |
| Color: Linear BG (gradient) | hardcoded `linear-gradient(...)` `:51` | ⚠ no variable |
| Effect: Sombra | 2 hardcoded variants | ⚠ no variable; 1 Figma style vs 2 code variants |
| Layout guides | none (fixed `930px`, `90%`, `900px` max-widths) | ⚠ unverifiable without the guide specs |

**In code, not in Figma (candidates to add to Figma or delete from code):**
- Text: 18/23, 18/18, 16/19, 14/16, 12/15, 12/auto, 52/53 (all used) · Inter family · weights 300 / 500 / 700.
- Color: `#757575` (×5), `#808080` (×2), `#f5450d` danger, `#07d635` success, `rgba(0,0,0,.16)` shadow.
- Radii (4/5/8/15), spacing scale, `930px` breakpoint.

**In Figma, not in code:** H1/H2 Tablet+ text styles; `--linear-bg` and `--shadow-sombra` variables; (layout-guide equivalents).

---

## 5. Component candidates

| # | Component | Appears | Variants (→ props) | Consistency |
|---|---|---|---|---|
| 1 | **SectionTitle** (heading + lead paragraph) | `index.html:31–37, 89–92, 132–135` (+ `h1`/`p` in header 19–22, + lone `h2` 129) | `tone`: light-on-dark / dark-on-light / on-gradient; `level` h1/h2; lead optional | ⚠ Same type styles redeclared in 5 CSS blocks with different `margin`/`padding` (20/30 mb; 50/30 pt) and 3 different grey/white colors |
| 2 | **Button / CTA** | Header link `23–25`, plan `<button>` ×3 (`143, 154, 164`) | `variant`: filled-light (header, 85–102) / outline-orange (491–504); `icon`: arrow-down / arrow-right; element `a`/`button` | ❌ Two different looks, different radius (5 vs 4), height both 48, width 229 vs 150, header one is absolutely positioned with magic numbers |
| 3 | **FeatureCard** | `94–125` (×4) | `icon` (clock/eye/dollar-sign/check-circle), `title`, `body` | ✅ Identical structure; icon via 4 CSS classes `:343–357` → prop |
| 4 | **PlanCard** | `137–166` (×3) | `badge` (none / "Recomendado" orange / "Más vendido" blue), `title`, `price`, `note`, `cta` | ⚠ Badge markup is **inconsistent**: card 1 puts `<p.recommended>` *inside* `.plan-info-container` (139); card 2 puts it *outside* (147). Positioning is `absolute` relative to different parents |
| 5 | **Badge / Chip** | `.recommended` (139, 147; `447–462`), `.currency-table--date` (60, 81; `257–276`) | `color`: orange / blue / soft-orange / soft-blue | ⚠ Two chips with different size/radius/type; both color-themed via modifier classes with `!important` |
| 6 | **CurrencyTable** (data table) | `39–63`, `64–84` | `title`, `tone` (orange/blue), `rows[{label,value,trend?}]`, `updatedAt` | ✅ Same structure; ⚠ built with `<div>` grid not `<table>`; trend icon only on table 1 (`.icon.up/.down`); 4 corner-radius modifier classes instead of CSS on first/last child |
| 7 | **Header / Hero** | `16–27` | logo, title, lead, CTA | single instance; fixed heights |
| 8 | **Footer** | `170–181` | links[], logo | single instance; `.right` has no CSS; links inactive |
| 9 | **Icon** | 4 feature + 2 trend + 2 arrow + batata + logos | `name`, `color`, `size` (20 feature, 15 trend, 20 arrow) | ❌ Implemented as empty `<span>` with `background-image`; color baked into SVG; no accessible name |
| 10 | **Section / PageSection** | Wrappers `.main-*-container` | `bg`: off-white / warm-black / image | ⚠ Each section re-declares `width:100%; min-width:320px; text-align:center` |
| 11 | **Slider (scroll-snap row)** | `.plans-container--slider` `:424–431` | disabled at ≥930px (`tablet.css:11–14`) | single instance |

Inputs/forms: **none exist**. Nav: **none**.

---

## 6. CSS quality

| Aspect | Finding |
|---|---|
| **Naming** | Mixed BEM-like with **non-standard separators**: `block--element` (double dash used as "element", not modifier), `grid__top-left` (BEM element with `__`), `__orange`/`__soft-blue`/`__bg-blue` (leading `__` utility modifiers), `.recommended`, `.icon.up`. No single convention. Triple-chain names like `.currency-table--container--grid` |
| **Specificity** | Mostly flat, but: `!important` ×3 (`:178, 182, 268`) to override simple rules — only needed because the chained selector `.main-currency-table .currency-table--title` outranks the utility. Descendant overrides like `.currency-table--container .currency-table--container--grid .grid__bottom-right` (226–230) are over-qualified. Type selectors `header`, `main`, `footer`, `footer section` styled globally (`:42, 112, 517, 524`) and `.currency-table--container--grid div` (197) |
| **Duplication** | The 24/26 bold heading is declared 5×; 14/18 lead 4×; `background-size:cover; position:center; no-repeat` icon boilerplate 4×; `margin:0 auto` ×7; `width:90%; min-width:288px` pattern ×4 |
| **Dead / unused** | `.table__right` (`:232`) — no HTML uses it; `footer .right`/`.left` section: `.right` has no rule; `/* gap: 50px; */` commented (`:426`); `.recommended`'s `height:31px` + padding conflicts; unused assets (§2); `body` reset duplicate |
| **Magic numbers** | `left: calc(50% - 118px)` for a 229px button (should be 114.5 → **off-center by 3.5px**) (`:87`); `top: 270px` hard-coupled to header height 334 (`:88`); `calc(50% - 20px)`/`-60px` centering instead of `translateX(-50%)` or flex; `margin: 50px 5px 0px` on slider card; heights 218/250/316/334 |
| **Box-model risk** | Fixed `height` on content (header, card, grid) → overflow with longer Spanish copy or user zoom |
| **Responsive** | Mobile-first intent, but: single breakpoint 930px, fixed `930px` containers in `tablet.css:1–10` (nothing between 600–929px is designed), no fluid type, `html{font-size:62.5%}` overrides user default font-size preference partially (rem-based so still scales, but the percentage hack is flagged by a11y reviewers) |
| **Comment header** | Property-order doc (`:1–7`) is a nice convention — but not enforced (no stylelint) |
| **Language mix** | Comments in Spanish, class names English, content Spanish. Fine, but an AI-readable DS should declare a language policy in `AGENTS.md` |

---

## 7. Accessibility

### 7.1 Semantics & structure

| Check | Finding |
|---|---|
| `lang` | `en` on `<html>` (`:2`) but all content is **Spanish** → should be `es` |
| `<title>` | "Document" (`:6`) |
| Landmarks | `header`, `main`, `footer` ✅. No `nav` (no navigation exists). Header `<header>` contains the `h1` ✅ |
| Heading hierarchy | `h1` → `h2` ×4 → `h3` ×3 (plan titles). Order valid ✅. But card titles (`.product--card-title`), table titles (`.currency-table--title`) are `<p>` and should likely be `h3`; the `h2` "Conócelo hoy." (`:129`) is an image-overlay slogan with no content below it |
| Table data | `<div>` grid (`:42–58, 67–79`) — no `<table>`, `<th>`, or `role="table"`; screen readers read it as flat text. Label/value pairing is lost |
| Lists | Feature cards and plan cards are `<article>`s directly inside `<section>`; a `<ul>` would convey the "4 items" |
| `section` inside `section` | `section.main-tables-container` nested in `section.main-exchange-container` (`:38`), `section.product-cards--container` (`:93`) with no headings → not real landmarks (sections without accessible names) |
| Alt text | Header logo `alt=""` (`:17`) — decorative flag on the brand mark; footer logo `alt="Logo de Batatabit 2020"` (`:179`) OK but includes "Logo de" + "2020" noise. All icons are CSS backgrounds → no alternative text; `trend up/down` meaning (rising/falling) is **lost for AT users** and communicated by color alone to sighted ones |
| Hero images | `Bitcoin.svg` and `bitcoinbaby2x.jpg` are CSS backgrounds (purely decorative — acceptable) |
| Links | Footer links `href="#"` ×3 (`:173–175`) = dead links; CTA `href="#plans"` ✅ |
| Buttons | `<button class="plan-card--ca">` has no `type` and no accessible context ("Escoger este" ×3 identical → ambiguous out of context; needs `aria-label="Escoger plan Pago Mensual"` or visually-hidden text) |
| Forms / inputs | **None** → no label issues |

### 7.2 Color contrast (WCAG 2.2 AA: 4.5:1 normal text, 3:1 large ≥18.66px bold/24px, 3:1 UI)

Computed from the real hex values.

| Foreground → Background | Where | Ratio | Verdict |
|---|---|---|---|
| `#bababa` → `#ffffff` | Currency names, odd cells (`:205–206`) 16px | **1.94** | ❌ FAIL |
| `#ffffff` → `#f7931a` | Badge "Recomendado" 12px (`:454–457`); footer links 14px (`:544` on footer `:521`) | **2.30** | ❌ FAIL |
| `#ffffff` → `#1a9af7` | Badge "Más vendido" 12px (`:460`) | **3.00** | ❌ FAIL (needs 4.5) |
| `#f7931a` → `#faf8f7` | Table title "Monedas" 18px bold (`:178`) | **2.17** | ❌ FAIL (large text needs 3) |
| `#1a9af7` → `#faf8f7` | Table title "Comisiones" (`:182`) | **2.83** | ❌ FAIL (large needs 3) |
| `#808080` → `#282623` | Feature card body 14px (`:371`) | **3.82** | ❌ FAIL |
| `#808080` → `#201e1c` | Dark-section lead (`:318`) | **4.21** | ❌ FAIL (close) |
| `#757575` → `#faf8f7` | Exchange lead (`:157`), plans lead (`:421`), saving (`:488` on white) | **4.35** (off-white) / 4.61 (white) | ❌ FAIL on off-white, ✅ on white |
| `#757575` → `#ffffff` | Even table cells (`:211`) | 4.61 | ✅ |
| `#282623` → `#faf8f7` | Headings, header button, plan text | 14.25 | ✅ |
| `#ffffff` → `#282623` / `#201e1c` | Card titles / headings on dark | 15.09 / 16.62 | ✅ |
| `#201e1c` → `#ffe9d5` / `#e7f5ff` | Date chips | 14.14 / 14.96 | ✅ |
| `#282623` → `#f7931a` | (candidate fix: dark text on orange) | 6.57 | ✅ — **suggests badges/footer should use dark text** |
| `#f7931a` border → `#faf8f7` | Plan CTA outline (`:496`) | 2.17 | ❌ non-text UI needs 3:1 (text inside is fine) |
| White h1 → gradient `#201e1c→#f7931a` | Hero (`:51`) | text sits in the dark half; `#ffe9d5` lead is OK on dark half, drops toward ~2–3:1 near the orange corner on narrow screens | ⚠ depends on viewport — not measured |

Totals: **8 failing combinations** at AA, **4 distinct brand-color problems** (orange text/bg, blue text/bg, grey, both mid-greys).

### 7.3 Focus, motion, misc.

- **No `:focus`/`:focus-visible`, no `:hover`/`:active`** styles anywhere (grep: none). Defaults apply; on the orange/dark backgrounds the default ring may be invisible.
- **Slider** (`:424–431`): `overflow-x: scroll` container with no `tabindex`, no role/label → keyboard users can't scroll it in some browsers; scroll-snap `proximity`. The scroll bar is also visible (no hiding).
- `scroll-behavior:smooth` (`:29`) without `@media (prefers-reduced-motion)`.
- Touch target: CTA 48px height ✅; footer links ~18px line-height + 10px margin (~38px, below 44 AAA / ok for AA 24px).
- Text spacing / zoom: fixed `height` on header, cards, grid will clip at 200% text zoom (WCAG 1.4.4/1.4.12 risk).
- `meta viewport` ✅ (no `user-scalable=no`).

---

## 8. Proposed token naming

Format works in both Figma variables (`color/primary`) and CSS (`--color-primary`) by simple `/`→`-` substitution, with a `--` prefix.

### 8.1 Primitive layer (raw values, no meaning)

| Figma name | CSS | Value | From today's… |
|---|---|---|---|
| `orange/500` | `--orange-500` | #f7931a | Bitcoin Orange |
| `orange/100` | `--orange-100` | #ffe9d5 | Soft Orange |
| `blue/500` | `--blue-500` | #1a9af7 | Secondary Blue |
| `blue/100` | `--blue-100` | #e7f5ff | Soft Blue |
| `neutral/900` | `--neutral-900` | #201e1c | Warm Black |
| `neutral/800` | `--neutral-800` | #282623 | Warm Black+1 / `--black` |
| `neutral/600` | `--neutral-600` | #757575 | hardcoded ×5 |
| `neutral/500` | `--neutral-500` | #808080 | hardcoded ×2 (candidate to merge with 600) |
| `neutral/300` | `--neutral-300` | #bababa | Grey |
| `neutral/50` | `--neutral-50` | #faf8f7 | Off White |
| `neutral/0` | `--neutral-0` | #ffffff | Just White |
| `green/500`, `red/500` | `--green-500`, `--red-500` | #07d635, #f5450d | trend icons (to confirm in Figma) |
| `font/family/sans`, `font/family/data` | `--font-family-sans`, `--font-family-data` | DM Sans, Inter | |
| `font/size/{12,14,16,18,24,40,52}` | `--font-size-14` … | px→rem | |
| `font/weight/{regular,medium,bold}` | `--font-weight-*` | 400/500/700 (+light 300 if kept) | |
| `space/{1..12}` | `--space-1` … | 4-px scale: 4,8,12,16,20,24,32,40,48,64,80 | |
| `radius/{sm,md,lg,xl}` | `--radius-sm` … | 4, 8, 15→16, … | |
| `shadow/sombra-warm`, `shadow/sombra-dark` | `--shadow-…` | the 2 variants | |

### 8.2 Semantic layer (meaning — what components consume)

| Figma name | CSS | Alias of | Replaces |
|---|---|---|---|
| `color/primary` | `--color-primary` | orange/500 | `--bitcoin-orange` |
| `color/primary-soft` | `--color-primary-soft` | orange/100 | `--soft-orange` |
| `color/secondary` | `--color-secondary` | blue/500 | `--secondary-blue` |
| `color/secondary-soft` | `--color-secondary-soft` | blue/100 | `--soft-blue` |
| `color/surface-dark` | `--color-surface-dark` | neutral/900 | `--warm-black` |
| `color/surface-dark-raised` | `--color-surface-dark-raised` | neutral/800 | `--black` / Warm Black+1 |
| `color/surface-page` | `--color-surface-page` | neutral/50 | `--off-white` |
| `color/surface-card` | `--color-surface-card` | neutral/0 | `--just-white` |
| `color/text-strong` | `--color-text-strong` | neutral/800 | headings on light |
| `color/text-muted` | `--color-text-muted` | neutral/600 → **darken to ≥ #6b6b6b for AA on off-white** | `#757575` |
| `color/text-on-dark` | `--color-text-on-dark` | neutral/0 | headings on dark |
| `color/text-muted-on-dark` | `--color-text-muted-on-dark` | neutral/500 → lighten to ≥ #9a9a9a | `#808080` |
| `color/text-subtle` | `--color-text-subtle` | neutral/300 | `--grey` (decorative only — currently fails) |
| `color/on-primary` | `--color-on-primary` | neutral/800 | text over orange (white fails) |
| `color/trend-up`, `color/trend-down` | `--color-trend-up/down` | green/500, red/500 | SVG strokes |
| `gradient/hero` | `--gradient-hero` | neutral/900→orange/500 @207.8° | Linear BG |
| `shadow/card`, `shadow/card-dark` | `--shadow-card`, `--shadow-card-dark` | Sombra variants | `Sombra` |
| `text/heading-lg` | `--text-heading-lg-size/-line` | 24/26 (mobile) → 40/42 (tablet+) | H1 Mobile / H1 Tablet+ |
| `text/lead` | `--text-lead-size/-line` | 14/18 → 20/24 | H2 Mobile / H2 Tablet+ |
| `text/body`, `text/caption`, `text/price`, `text/title-md` | … | 16/19, 12/15, 52/53, 18/23 | currently Figma-less sizes |
| `space/section`, `space/stack`, `space/inset` | … | 80 / 30 / 15 | recurring section paddings |
| `radius/button`, `radius/card`, `radius/chip` | … | 5(or 4) / 15 / 8 | |
| `breakpoint/tablet` | `--breakpoint-tablet` (doc/JS only; not usable in `@media`) | 930 → recommend 768 or 960 | |

**Naming notes:** (1) rename text styles **H1 Mobile/H2 Mobile → `heading/lg`, `lead`** so “H2” doesn’t refer to `<p>`; keep Mobile/Tablet+ as *modes* in Figma variables rather than separate styles (one token, two values). (2) `--black` must be renamed — AI tools will assume `#000`.

---

## 9. Top components to build first (demo)

1. **Button** — *two variants, two elements, two icons, three usages; single most visible "before/after".* Exposes the inconsistencies (4px vs 5px radius, absolute positioning hack, `a` vs `button`) and is trivially documented/MCP-queryable (`variant`, `icon`, `as`).
2. **SectionTitle (Heading + Lead)** — *replaces 5 CSS duplicates and is where the missing Tablet+ type tokens land.* Best vehicle to show tokens driving a responsive change (24/26 → 40/42) and the “H2-is-a-p” naming fix.
3. **FeatureCard** — *4 identical instances → one component + data array.* Cleanest "loop over props" demo and a strong LOC-reduction metric; introduces the Icon abstraction.
4. **PlanCard (with Badge)** — *richest props surface* (badge variant, price, note, CTA) and currently has the inconsistent markup (139 vs 147) a component fixes; ideal for showing an AI correctly choosing `badge="recommended"` from docs.
5. **Badge / Chip** — *small, fully token-driven (color, radius, type); fixes 2 of the 8 contrast failures* → a measurable accessibility win for the talk, and shows semantic color tokens (`color/on-primary`).
6. **CurrencyTable** — *highest "semantic HTML" payoff* (div-grid → real `<table>`), data-driven rows with trend direction (needs a text alternative), and demonstrates a data-prop component an MCP server can describe.

(Header/Hero, Footer, Icon and Section wrapper are single-instance or supporting; build after the six above, with Icon created as part of FeatureCard/Table.)

**Measurable before/after candidates for the talk:** CSS lines (545 → ?), hardcoded color literals outside `:root` (13 → 0), distinct font-size/LH pairs (12 → ~6), AA contrast failures (8 → 0), unreferenced assets (≈1.1 MB), Lighthouse a11y score (not measured yet), Figma↔code token name parity (today: 9/10 colors named alike, 0/4 text, 0/1 effect).

---

## 10. Risks and open questions

### Migration readiness for Astro

| Translates directly | Needs refactoring | Special handling |
|---|---|---|
| Static HTML structure; `assets/` → `public/` or `src/assets`; Google Fonts link in layout `<head>`; CSS can be imported globally as-is | Per-section class names → scoped component styles; `css/tablet.css` loaded via `<link media>` (move to `@media` inside CSS/tokens); CSS `url("./assets/...")` paths (incl. `assets//img` double slash `:378`) must be re-pointed for Vite; `!important` utilities; SVG icons → inline `.astro` components using `currentColor`; `<div>` grid → `<table>` | **No JavaScript exists**, so no islands/hydration needed. Scroll-snap slider is CSS-only (keyboard fix needs tiny optional JS or `tabindex`). Replace `html{font-size:62.5%}` carefully: every rem value is calibrated on it, so changing it re-scales everything |

### Risks

1. **Figma values unknown to me** — the whole “parity” claim depends on validating H1/H2 Tablet+, Grey, Warm Black+1, Sombra values in Figma. Mismatch could be larger than inferred.
2. **Fixing contrast changes the brand look** (orange badges/footer get dark text, `#757575` darkens). Needs a designer decision *in Figma first* so code and Figma stay aligned for the talk.
3. **The 930px breakpoint is a magic number**; moving to a standard value changes the visual result at 768–930px, which today shows the mobile layout on tablets.
4. **Type changes cascade:** adding 40/42 and 20/24 will alter hero height, button offset (absolute `top:270px`), and section spacing — the hero must be restructured (flex/grid) rather than just restyled.
5. **Font weights**: loading the actually-used weights changes rendering slightly (real bold instead of synthesized) and adds ~2 font files.
6. **Demo credibility:** "AI-ready" claims need a measurable benchmark (e.g., same prompt with/without AGENTS.md + MCP) — none exists yet.
7. **Product naming inconsistency** (Batabit/Batatabit/Babtabit; repo “BatataBit”) will leak into component docs and AI outputs.
8. **Content language**: Spanish copy vs English code; docs/AGENTS.md language must be chosen deliberately for the talk audience.

### Open questions (before we plan)

1. **Can you share the Figma values** (or file link/export) for: the 4 text styles incl. font family/weight, "Grey", "Warm Black+1", "Linear BG" stops/angle, "Sombra" params, and the layout guides (columns, margin, gutter)? Is `--black` really "Warm Black+1"?
2. **Brand vs. accessibility:** may we change colors (text-on-orange, muted greys, badge blue) to hit WCAG AA, or is brand fidelity non-negotiable (accept documented exceptions)?
3. **Token naming:** OK with `color/primary` semantics + `orange/500` primitives (§8)? Should Mobile/Tablet+ be Figma *variable modes* instead of separate styles?
4. **Breakpoints:** keep 930px or standardize (e.g., 768/1024)? Is anything between 600–930px designed in Figma?
5. **Astro scope:** single page only, or should the demo add a second page to show reuse? Any need for Tailwind/Starlight for component docs, or hand-written Markdown only?
6. **MCP scope:** read-only (list components, props, tokens, docs) or also a `validate`/`lint` tool? Which language/runtime (TypeScript, official MCP SDK) and how will it be run on stage?
7. **Language:** content/docs in Spanish, English, or bilingual? Component prop names in English?
8. **Product name:** canonical spelling (Batabit / Batatabit / BatataBit)? 
9. **Behavior to keep:** is the plan-card horizontal slider (mobile) required as-is, and should the currency data stay static or be mocked as data?
10. **Unused assets:** OK to drop the unreferenced images/icons and to introduce responsive images (`srcset`/Astro `<Image>`) for the hero photo?
11. **Demo metrics:** which numbers do you want on slides (LOC, token coverage, a11y score, Figma parity %)? I can capture baselines now for any you pick.

---

## 11. Figma values (confirmed)

Source: Figma file `LjxBqsWv8fhgPgFNWP5nJP` (BatataBit), node `359:319` ("iPad Pro 11" - 1", 834×3663), read via `get_variable_defs`, `get_screenshot`, `get_metadata` and `get_design_context` on 2026-10-30. This supersedes the "(assumed)" caveat at the top of the report for the rows below.

Limits of this read: `get_variable_defs` only returns styles used inside the selected node. This node is the **tablet** frame, so **H1 Mobile** (24/26) was not returned. The tools returned **no layout-guide data** and **no gradient stops** for Linear BG.

### 11.1 Colors

| Figma style | Exact value | Code token | Code value | Status |
|---|---|---|---|---|
| Bitcoin Orange | `#F7931A` | `--bitcoin-orange` | `#f7931a` | ✅ confirmed |
| Soft Orange | `#FFE9D4` | `--soft-orange` | `#ffe9d5` | ❌ **mismatched** (blue channel off by 1: D4 vs D5) |
| Secondary Blue | `#1A9AF7` | `--secondary-blue` | `#1a9af7` | ✅ confirmed |
| Soft Blue | `#E7F5FF` | `--soft-blue` | `#e7f5ff` | ✅ confirmed |
| Warm Black | `#201E1C` | `--warm-black` | `#201e1c` | ✅ confirmed |
| Warm Black+1 | `#282623` | `--black` | `#282623` | ✅ value confirmed (was assumed); ⚠ name still differs (`--black`) |
| Grey | `#BABABA` | `--grey` | `#bababa` | ✅ value confirmed (was assumed) |
| Off White | `#FAF8F7` | `--off-white` | `#faf8f7` | ✅ confirmed |
| Just White | `#FFFFFF` | `--just-white` | `#fff` | ✅ confirmed |
| Linear BG | variable returned with **empty value** | hardcoded `linear-gradient(207.8deg, #201e1c 16.69%, #f7931a 100%)` (`styles.css:51`) | — | ⚠ **unconfirmed**: stops/angle not exposed. Screenshot is visually consistent (dark `#201E1C`-like top-right, orange bottom-left), but exact angle and stop positions are not verified |

Not in Figma (confirmed absent from this node's styles): `#757575`, `#808080`, `#f5450d`, `#07d635`.

### 11.2 Text styles

| Figma style | Exact value | Code | Status |
|---|---|---|---|
| H1 Tablet+ | DM Sans Bold (700), 40 / 42, letter-spacing 0 | none in code | ✅ confirmed as **missing in code** (value now known: 40/42, 700) |
| H2 Tablet+ | DM Sans Medium (500), 20 / 24, letter-spacing 0 | none in code | ✅ confirmed as **missing in code** (value now known: 20/24, **500**) |
| H2 Mobile | DM Sans Medium (500), 14 / 18, letter-spacing 0 | `1.4rem/1.8rem` on subtitle `<p>`s | ✅ size/line-height confirmed. Weight 500 matches only if the code lead uses 500 (not re-checked here) |
| H1 Mobile | not returned (tablet frame) | `2.4rem/2.6rem bold` | ⚠ **unconfirmed** (24/26 remains inferred) |

### 11.3 Effects

| Figma style | Exact value | Code | Status |
|---|---|---|---|
| Sombra /Blanco | DROP_SHADOW `#59491E29` (rgb 89,73,30 @ 16%), offset (0, 4), blur 8, spread 0 | `0 4px 8px rgba(89,73,30,.16)` (`:96`, `:444`) | ✅ confirmed |
| Sombra /Negro | DROP_SHADOW `#00000029` (black @ 16%), offset (0, 4), blur 8, spread 0 | `0 4px 8px rgba(0,0,0,.16)` (`:330`) | ✅ confirmed |

**Correction to §3.5 and §4:** Figma has **two** Sombra styles, "Blanco" (warm tint, for light surfaces) and "Negro" (for dark surfaces). The earlier note "Figma has only one Sombra" was wrong. The two code variants map 1:1. Suggested tokens: `--shadow-sombra-blanco`, `--shadow-sombra-negro` (replacing the `shadow/card` and `shadow/card-dark` names proposed in §8).

### 11.4 Layout guides

**Unconfirmed.** Neither `get_variable_defs` nor `get_metadata` exposes layout guides (columns, margin, gutter). Not verified. Observed geometry only, from node metadata: frame width 834 (iPad Pro 11"); text blocks centered at x=184 with width 466 (≈ 184 left / 184 right margin); card rows at x=64 to 769 (64 margin, 705 content width). These suggest a ~64px outer margin in the grid sections, but this is **inferred from positions, not from guides**. Needs a read via the Figma plugin API (`use_figma`) or a manual check.

### 11.5 Updated mapping status

| Row in §3/§4 | Previous | Now |
|---|---|---|
| Warm Black+1 = `--black` | assumed | ✅ confirmed (`#282623`), rename still needed |
| Grey = `--grey` | assumed | ✅ confirmed (`#BABABA`) |
| H1 Tablet+ | missing in code | ✅ confirmed missing; 40/42 bold |
| H2 Tablet+ | missing in code | ✅ confirmed missing; 20/24 medium |
| Linear BG | assumed, hardcoded | ⚠ unconfirmed (no value returned) |
| Sombra | assumed, 1 style | ✅ confirmed, but **2 styles** (Blanco/Negro) |
| Soft Orange | matched | ❌ mismatch: Figma `#FFE9D4` vs code `#ffe9d5` |
| Layout guides | unverifiable | ⚠ still unverifiable via these tools |
| H1 Mobile | matched (inferred) | ⚠ not re-read; unconfirmed |

Open follow-ups: (1) decide which Soft Orange is canonical and fix one side; (2) read Linear BG stops/angle and layout guides via `use_figma`; (3) read the mobile frame to confirm H1 Mobile.
