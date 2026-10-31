# Phase 5a — Proposal (no code, tokens or Figma were changed)

Baseline: tag `v3-components` (`8db40d4`). Every number below was measured on that build or read from Figma (file `LjxBqsWv8fhgPgFNWP5nJP`, tablet frame `359:319`, read-only). Contrast uses the WCAG 2.2 formula; "AA" means 4.5:1 for text under 18.66px bold / 24px regular, and 3:1 for large text and for UI boundaries and graphics. Experiments ran on throwaway copies outside the repo; `git status` is clean apart from this file.

## 0. Decisions needed from you (recommendation first)

| # | Decision | Recommendation |
|---|---|---|
| D1 | How table titles ("Monedas", "Comisiones") pass contrast | Dark text + 4px brand-colour accent bar for both (§1) |
| D2 | How the hero lead passes contrast over the gradient | Move the gradient's dark stop from 16.69% to 65%; keep the soft-orange lead (§1) |
| D3 | Spacing: A (snap to 4px scale) or B (5-based) | **A** (§2) |
| D4 | Corner radii: Figma says buttons 4, feature card 4, plan card 8; code has 5 / 5 / 15 | Follow Figma; confirm the table grid radius in Figma first (§3) |
| D5 | Breakpoint: Figma's tablet frame is 834px wide, code switches at 930px | Out of scope as instructed, but 834 never renders today; decide before 5b (§3) |
| D6 | Caption weight 300 is not loaded and renders as 400; the chip's `<strong>` renders 400 | Caption → 400, `<strong>` → explicit 700 (§5e) |
| D7 | Heading→lead gap: Figma uses 24 in sections and 32 in the hero | One gap, 24 (§5a) |
| D8 | Outline-button border contrast (2.17:1) | Darken the border to `#CF7407` (§1, row 13) |

### Findings from this read that were not in AUDIT.md
1. **The hero lead fails contrast over the gradient.** Worst-pixel contrast of `#FFE9D4` under the real text lines is 2.98:1 at its worst (320px) (2.67:1 at 375px if the whole text box is sampled). AUDIT marked it "not measured".
2. **18px bold is not "large text".** The threshold is 18.66px bold, so the table titles need 4.5:1, not the 3:1 AUDIT assumed.
3. **Figma's button label colour is `#201E1C`** (Warm Black), not Warm Black+1. Code uses `#282623`.
4. **Figma radii differ from code** (see D4). Both buttons are 4px in Figma, which settles the 5px vs 4px question.
5. **The Figma tablet text boxes are exactly 466px wide.** At 40/42 and 20/24 they wrap to the same line counts as Figma (126px h1, 84px h2, 72px lead). The code's 900px max-width would not reproduce them.
6. **Content drift in Figma:** the table chips read "Valores en $ USD", while code reads "Actualizado: 19 Julio 23:45". Figma's copy also still has "Batabit" and "Babtabit".

---

## 1. Contrast (target: 0 AA failures)

Rule used: change the smallest amount that passes, keeping hue and saturation, and leave a margin of about 0.3 above the threshold so rounding or a small gradient shift cannot flip a result.

### 1.1 Before / after

| # | Where | Foreground → background | Before | After | What changes |
|---|---|---|---|---|---|
| 1 | Table labels (16px) | `#BABABA` → `#FFFFFF` | 1.94 ❌ | `#6E6E6E` → 5.10 ✅ | labels use `color.text-muted`; `color.text-subtle` is deleted |
| 2 | Table values (16px) | `#757575` → `#FFFFFF` | 4.61 ✅ | `#201E1C` → 16.62 ✅ | values move to `color.text-strong` so they stay stronger than the labels |
| 3 | Leads on off-white (exchange, plans) | `#757575` → `#FAF8F7` | 4.35 ❌ | `#6E6E6E` → 4.82 ✅ | `neutral/600` darkens |
| 4 | Plan note (12px) | `#757575` → `#FFFFFF` | 4.61 ✅ | `#6E6E6E` → 5.10 ✅ | follows `neutral/600` |
| 5 | Feature-card body | `#808080` → `#282623` | 3.82 ❌ | `#929292` → 4.85 ✅ | `neutral/500` lightens |
| 6 | Detail lead | `#808080` → `#201E1C` | 4.21 ❌ | `#929292` → 5.34 ✅ | follows `neutral/500` |
| 7 | Badge "Recomendado" | `#FFFFFF` → `#F7931A` | 2.30 ❌ | `#201E1C` → 7.23 ✅ | `color.on-primary` → `neutral/900` |
| 8 | Footer links (14px) | `#FFFFFF` → `#F7931A` | 2.30 ❌ | `#201E1C` → 7.23 ✅ | same token as row 7 |
| 9 | Badge "Más vendido" | `#FFFFFF` → `#1A9AF7` | 3.00 ❌ | `#201E1C` → 5.55 ✅ | new `color.on-secondary` → `neutral/900` |
| 10 | Table title "Monedas" (18px bold) | `#F7931A` → `#FAF8F7` | 2.17 ❌ | `#201E1C` → 15.69 ✅ + orange bar | pattern, see 1.2 |
| 11 | Table title "Comisiones" | `#1A9AF7` → `#FAF8F7` | 2.83 ❌ | `#201E1C` → 15.69 ✅ + blue bar | pattern, see 1.2 |
| 12 | Hero lead over gradient | `#FFE9D4` → worst gradient pixel | 2.98 (min, at 320px) ❌ | min 5.83 across 320–1920px ✅ | `gradient.hero` dark stop 16.69% → 65% |
| 12b | Hero h1 (large text, ≥3:1) | `#FFFFFF` → worst gradient pixel | min 4.23 ✅ | min 11.56 ✅ | same gradient change |
| 13 | Outline-button border (UI boundary) | `#F7931A` → `#FAF8F7` | 2.17 ❌ | `#CF7407` → 3.22 (3.41 on white) ✅ | new `color.border-accent` |
| 14 | Trend-up icon (graphic, 3:1) | `#07D635` → `#FFFFFF` | 1.97 ❌ | `#05A629` → 3.23 ✅ | `green/500` → new `green/600` for the semantic token |
| 15 | Trend-down icon | `#F5450D` → `#FFFFFF` | 3.66 ✅ | unchanged | none |

Already passing and unchanged: headings (15.69–16.62 after the `text-strong` alias swap, see §7), white on dark surfaces (15.09), chip text `#282623` on the soft tints (12.83 on `#FFE9D4`, 13.58 on `#E7F5FF`).

Row 13 is conservative: WCAG 1.4.11 can be read as satisfied when the button's text label (about 15.7:1) identifies the control. It is listed because you asked for 0 failures. Declining it is a safe option, and the only cost is that the claim becomes "0 failures, one documented reading".

### 1.2 Why a pattern for the table titles, not a darker orange

- **Orange cannot be text.** The lightest orange that reaches AA on off-white is `#A45C06` (4.82:1). That is ochre-brown and no longer reads as Bitcoin Orange.
- **Blue could survive as text.** `#0771BF` (4.81:1) is still clearly blue.
- **Recommendation:** use the same pattern for both tables so the component has one rule. The title is `color.text-strong`, with a 4px-tall, 32px-wide bar in `color.primary` or `color.secondary` under it. The brand colour stays visible; only the text is dark.
- **Trade-off:** coloured headings were a small piece of brand expression, and the accent bar adds a new element to Figma. Contrast comes out at 15.69:1.
- **Fallback if you want coloured titles:** `orange/700 = #A45C06` and `blue/700 = #0771BF`. They add two primitives, and orange loses its brand feel.

### 1.3 Hero gradient: the options tested

Worst-pixel contrast of the lead over the real rendered gradient, measured at 320 / 375 / 600 / 930 / 1200 / 1920px. At 930px and above the 40/42 + 20/24 type is applied, because that is how it will ship.

| Option | Lead (min over widths) | h1 white (min) |
|---|---|---|
| 1. Dark stop 16.69% (today), lead `#FFE9D4` | 2.98 ❌ | 4.23 |
| 2. Dark stop 55%, lead `#FFFFFF` | 5.19 ✅ | 7.82 |
| **3. Dark stop 65%, lead `#FFE9D4`** | **5.83 ✅** | **11.56** |

Re-measured with `scripts/contrast/hero-contrast.mjs` at 320–1920px, using the proposed ≥930px hero layout (466px measure, 480px tall). The lowest lead value is at 320px in every option. Renders for the three options are in `tests/visual/d2-options/`.

- **Alternative (option 2):** a white lead passes with a 55% stop and leaves more of the orange glow, but it drops the soft-orange tint. Option 3 keeps the lead colour and has the larger margin.
- **Visual consequence:** the header stays dark for more of its height and the orange glow shrinks to the bottom-left corner. This is the most visible change in the contrast work.

### 1.4 Token changes this implies

| Token | Change |
|---|---|
| `color.neutral.600` | `#757575` → `#6E6E6E` |
| `color.neutral.500` | `#808080` → `#929292` |
| `color.orange.600` (new primitive) | `#CF7407` |
| `color.green.600` (new primitive) | `#05A629` |
| `color.on-primary` | alias `neutral.0` → `neutral.900` |
| `color.on-secondary` (new) | alias `neutral.900` |
| `color.border-accent` (new) | alias `orange.600` |
| `color.trend-up` | alias `green.500` → `green.600` |
| `color.text-subtle` | deleted (no remaining use) |
| `gradient.hero` | dark stop `0.1669` → `0.65` |

The `text-muted` and `text-muted-on-dark` semantics keep their aliases, so they change only through the primitives.

Beyond the 7.2 inventory: there are still no `:focus-visible` styles anywhere. That is a separate follow-up and not part of this proposal.

---

## 2. Spacing scale

### 2.1 The 37 remaining raw values

35 plain `px` values in spacing properties, plus the two `calc()` offsets (118px and 20px).

| Raw | Uses | Where |
|---|---|---|
| -15 | 1 | PlanCard badge `top` |
| -10 | 1 | batata `top` |
| 0 | 1 | PlanCard `margin: 50px 5px 0px` |
| 2 | 1 | CurrencyTable grid `gap` |
| 5 | 2 | PlanCard side margin; price `padding` |
| 6 | 1 | Badge `sm` padding |
| 10 | 6 | detail padding-x; footer `li`; Button icon gap; table cell padding-x; trend gap; feature-icon margin-bottom |
| 15 | 6 | Button padding; table title margin; FeatureCard margin, padding, title margin; PlanCard padding-x |
| 25 | 1 | SectionTitle gap `md` |
| 30 | 5 | exchange padding-bottom; exchange title margin; table margin; plan title padding; SectionTitle gap `lg` |
| 35 | 1 | hero CTA `margin-top` |
| 50 | 5 | detail title margin-top; plans title margin-bottom and padding-top; two more section margins |
| 60 | 2 | hero logo margin-top; bitcoin image padding-top |
| 70 | 1 | plans padding-bottom |
| 270 | 1 | hero CTA `top` |
| `calc(50% - 118px)`, `calc(50% - 20px)` | 2 | hero CTA, batata (removed by §5d and a flex/transform rewrite) |

### 2.2 Option A: snap to the existing 4px scale

Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Rule: nearest step, ties go up.

| Raw | → | Shift | Notes |
|---|---|---|---|
| 5 | 4 | 1 | |
| 6 | 8 | 2 | Figma's badge padding is 8 |
| 10 | 12 | 2 | exceptions below |
| 15 | 16 | 1 | |
| 25 | 24 | 1 | |
| 30 | 32 | 2 | |
| 35 | 32 | 3 | |
| 50 | 48 | 2 | |
| 60 | 64 | 4 | |
| 70 | 64 | **6 (max)** | |
| -10 / -15 | -12 / -16 | 2 / 1 | |
| 2 (grid gap) | not spacing | — | reclassify as a divider width; snapping to 4 would double the line |
| 270, `calc(…118px)`, `calc(…20px)` | removed | — | by the hero rewrite (§5d) |

Two overrides are justified by Figma and keep the rule honest:
- Button icon gap and trend gap use **8**. Figma's button gap is 8.
- Table cell padding-x uses **12**. Figma's cell text sits at x=12.

**Measured effect.** A throwaway copy with the mechanical mapping applied gave:

| Width | Page height | Change | Breakdown |
|---|---|---|---|
| 375px | 3596 → 3620 | +24px (+0.7%) | exchange +10, detail +22, plans −8 |
| 1024px | 2804 → 2810 | +6px | exchange +7, detail +7, plans −8 |

### 2.3 Option B: a 5-based scale with no visual change

Steps would be 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80.
- The only differences from today: 6 → 5 (1px), and the 2px divider stays outside the scale.
- **It is not really a scale.** Phase 2 already tokenised the original values 8, 12 and 16 (chip padding, table cell padding, chip margin). Figma also uses 8, 12, 16, 24, 32, 40 and 48. Keeping them makes B an irregular 15-step list: 5, 8, 10, 12, 15, 16, 20, 25, 30, 35, 40, 50, 60, 70, 80.
- The alternative is re-snapping 8/12/16 to 10/15, which is a visual change and moves further from Figma.

### 2.4 Recommendation: A

- **Industry convention.** Tailwind, Material, Carbon and Polaris all use a 4px base. The scale you already shipped in Phase 2 is that one.
- **AI-readability.** Every value is a multiple of 4, so a model can predict the next step. Tokens named by pixel (`space.16`) remove the index-vs-pixel ambiguity.
- **Figma agreement.** The Figma tablet frame already uses 8, 12, 16, 24, 32, 40 and 48; the hero heading-to-lead gap is the lone 32.
- **Cost.** At most 6px of shift on any value and +24px on a 3.6k-px page.
- **B** is the right choice only if "no visual change at all" outweighs the other three points.

For reference, Figma tablet gaps in the frame: title→lead 24 in sections and 32 in the hero; lead→content 48 (exchange, plans) and 40 (detail); table divider 1px (code uses 2px).

---

## 3. Typography and radius

### 3.1 Applying `text.heading-lg.tablet` and `text.lead.tablet` at 930px

**Mechanism (recommended).** The generator emits one media query that reassigns the base variables, so components do not change:

```css
@media (min-width: 930px) {
  :root {
    --text-heading-lg-size: var(--text-heading-lg-tablet-size);
    --text-heading-lg-line: var(--text-heading-lg-tablet-line);
    --text-lead-size: var(--text-lead-tablet-size);
    --text-lead-line: var(--text-lead-tablet-line);
  }
}
```

- The 930 literal comes from a new `breakpoint.tablet` token, because custom properties cannot be used inside `@media`.
- Weights are identical across modes, so they are not reassigned.

**Which sections change** (all five `SectionTitle` instances; `body-sm`, card, table and price text do not change):

| Section | h: 24→40 | lead: 14→20 |
|---|---|---|
| Hero (h1) | ✅ | ✅ |
| Exchange "Visibilizamos…" | ✅ | ✅ |
| Detail "Creamos…" | ✅ | ✅ |
| "Conócelo hoy." | ✅ | no lead |
| Plans "Escoge…" | ✅ | ✅ |

**Required with it:** a title measure of `max-width: 466px` from 930px up, centered, which is what Figma uses. Measured at 930 and 1024px:

| Block | Today | 40/42 + 20/24, 900px wide | + 466px measure | Figma box |
|---|---|---|---|---|
| Hero (h1 + lead) | 69 | 133 | **199** (3 + 2 lines) | 126 + 48 |
| Exchange | 72 | 120 | **186** (2 + 3 lines) | 84 + 72 |
| Detail | 64 | 86 | **128** (2 + 1 lines) | 84 (+ lead 48) |
| Bitcoin | 26 | 42 | 42 | 42 |
| Plans | 74 | 96 | **162** (2 + 2 lines) | 84 + 48 |
| **Page height** | 2804 | 2896 | **3070 (+266)** | — |

With the 466 measure, the hero, exchange, bitcoin and plans blocks match Figma's boxes (line counts and heights) exactly, and the detail heading matches. The page grows by 266px at 930–1024px before any spacing change, so the +6px from §2 is small next to it.

**The hero must be restructured:**
- Today it has a fixed 334px height, a fixed 218px title container and an absolutely positioned CTA.
- At tablet, Figma's hero is 480px tall and the button straddles its bottom edge (button y 509–557, background bottom 533, so the button is centred on the edge).
- Use `min-height` instead of `height`: 334 on mobile, 480 from 930px up. See §5d.

**D5, breakpoint.** Figma's "tablet" frame is an iPad Pro 11" at **834px**, narrower than the 930px breakpoint, so the Figma tablet design never renders in code. Lowering the breakpoint also means fixing `tablet.css`-era fixed 930px containers (`width: 930px` on two layouts), which overflow below 930. That is a separate change, flagged here so 5b doesn't silently inherit it.

### 3.2 Unify `radius.button` (5px) and `radius.button-outline` (4px)

**Proposal: 4px.** Figma has 4px on both the hero button and the plan button. The result is one token, `radius.button`, and `radius.button-outline` is deleted. The visible effect is a 1px tighter corner on the hero button.

Other radii in Figma vs code (not asked for, but you should see them before 5b):

| Element | Figma | Code today | Proposal |
|---|---|---|---|
| Feature card | 4 | 5 (`radius.card-compact`) | 4 (follows Figma; `card-compact` merges into `radius.button`'s value or is renamed) |
| Plan card | 8 | 15 (`radius.card`) | 8 (follows Figma) |
| Badge | 8 | 8 (`radius.chip`) | none |
| Table grid | not read | 15 | keep 15 until verified in Figma |

The plan card is the noticeable one: 15px corners become 8px. If 15 was the intended design, fix Figma instead (D4).

### 3.3 Can `text.lead-tight` merge into `text.lead`? Yes

- Figma has no 14/16 style; its H2 Mobile is 14/18.
- The only user is the exchange lead; at 375px it wraps to 3 lines, so it grows by 6px (3 × 2).
- At tablet it scales like every other lead.
- The `tightLead` prop and `text.lead-tight` token both go away.

---

## 4. Token model fixes

### 4.1 Split `surface-page` so buttons own their fill

- New `color.surface-button` → `neutral.50`. Figma's button fill is `#FAF8F7`, unchanged in value.
- New `color.on-button` → `neutral.900`, matching Figma's `#201E1C` label. This also covers the arrow icon, which already uses `surface-dark` for parity.
- `color.surface-page` keeps only the page background.

### 4.2 Descriptions to rewrite

Rules applied: lead with the usage rule, no process notes ("Phase 5", "candidate to…", "kept for parity"), examples second, measured contrast only as a fact. Primitives are included where their text changes.

| Token | Old | New |
|---|---|---|
| `color.primary` | Brand orange. Use for accent text on light surfaces (table titles), badges/highlights, the footer background and the outline of secondary CTA buttons. Never use as body-text colour: contrast on off-white is 2.17:1 (fails WCAG AA). White text on it also fails (2.3:1); see color.on-primary. | Brand orange for solid fills and non-text accents: footer background, solid badge background, accent bars. Never for text (2.17:1 on off-white). Text placed on it uses color.on-primary. |
| `color.primary-soft` | Light orange tint. Use as a soft background for chips/pills (e.g. the 'Actualizado' date chip) and as the lead-paragraph text colour over the dark-to-orange hero gradient. Pair chip text with color.text-on-soft. | Tint of brand orange for soft backgrounds (chips, pills) and for lead text on the hero gradient. Text on a primary-soft background uses color.text-on-soft. |
| `color.secondary` | Brand blue. Use for accent text on light surfaces (the 'Comisiones' table title) and for the secondary badge background ('Más vendido'). Do not use for body text: contrast on off-white is 2.83:1. | Brand blue for solid fills and non-text accents: secondary badge background, accent bars. Never for text (2.83:1 on off-white). Text placed on it uses color.on-secondary. |
| `color.secondary-soft` | Light blue tint. Use as a soft chip/pill background in the blue variant (e.g. the date chip of the 'Comisiones' table). Pair text with color.text-on-soft. | Tint of brand blue for soft backgrounds (chips, pills). Text on it uses color.text-on-soft. |
| `color.surface-page` | Default light page background (main content area) and the fill of buttons placed on light or gradient backgrounds. | Page background of the main content area. Not for buttons (use color.surface-button) or cards (use color.surface-card). |
| `color.surface-button` | — (new) | Fill of every button, light and outline. Label and icon colour on it: color.on-button. |
| `color.on-button` | — (new) | Label and icon colour on color.surface-button. 15.7:1. |
| `color.text-muted` | Secondary text on light surfaces (lead paragraphs, table values, small notes). Contrast is 4.61:1 on white but 4.35:1 on off-white (fails AA on off-white); candidate to darken in a later phase. | Secondary text on light surfaces: lead paragraphs, table labels, small notes. 4.82:1 on off-white, 5.10:1 on white. Use color.text-strong for anything that must stand out. |
| `color.text-muted-on-dark` | Secondary text on dark surfaces (section lead, feature-card body). Contrast 3.82:1 on surface-dark-raised and 4.21:1 on surface-dark (fails AA); candidate to lighten later. | Secondary text on dark surfaces: section leads, card body text. 4.85:1 on surface-dark-raised, 5.34:1 on surface-dark. Use color.text-on-dark for headings. |
| `color.text-strong` | Primary text colour on light surfaces: headings, prices, button labels. Contrast on off-white 14.25:1. | Primary text colour on light surfaces: headings, prices, table titles and values. Aliases `neutral.900`: 15.69:1 on off-white, 16.62:1 on white. |
| `color.text-on-soft` | Text drawn over color.primary-soft or color.secondary-soft chips. Contrast ≈14:1. | Text drawn over color.primary-soft or color.secondary-soft chips. Aliases `neutral.800`: 12.83:1 on primary-soft, 13.58:1 on secondary-soft. |
| `color.text-on-dark` | Primary text on dark surfaces and on the hero gradient: headings, card titles, links on dark. Not for text on orange; use color.on-primary. | Primary text on dark surfaces and on the hero gradient: headings, card titles. On orange or blue fills use color.on-primary or color.on-secondary instead. |
| `color.text-subtle` | Decorative/de-emphasised text on white (the label column of data tables). Contrast on white is 1.94:1 (fails AA); do not use for essential information. | **Deleted.** |
| `color.on-primary` | Text/icons placed on color.primary or color.secondary fills (badges, footer links). Currently white to preserve the original look, but it fails WCAG AA (2.3:1 on orange, 3.0:1 on blue); intended to change to a dark neutral in a later, deliberate phase. | Text and icons placed on color.primary fills: solid orange badge, footer links. 7.23:1. |
| `color.on-secondary` | — (new) | Text and icons placed on color.secondary fills: solid blue badge. 5.55:1. |
| `color.border-accent` | — (new) | Outline colour of outline buttons. 3.22:1 on off-white, 3.41:1 on white. Use color.primary for fills, not for borders. |
| `color.trend-up` | Positive-change indicator (price up). Consumed by the Icon component (name 'trending-up'). Always pair with a text/aria alternative; colour alone is not enough. | Colour of the price-increase icon. 3.23:1 on white. Always give the icon a text alternative; never rely on colour alone. |
| `color.trend-down` | Negative-change indicator (price down). Consumed by the Icon component (name 'trending-down'). Always pair with a text/aria alternative. | Colour of the price-decrease icon. 3.66:1 on white. Always give the icon a text alternative; never rely on colour alone. |
| `color.neutral.*` / `orange.*` / `green.*` / `red.*` group notes | …"they are not in Figma"; "Only used by the trending-up SVG today"… | Describe what each step is for (e.g. "neutral.600: secondary text on light surfaces"); drop "not in Figma" once the styles exist there. |
| `radius.button` | Corner radius of filled buttons/links (hero CTA). Kept distinct from radius.button-outline (5px vs 4px) until they are deliberately unified. | Corner radius of every button: 4px. |
| `radius.button-outline` | Corner radius of outline buttons (plan CTA). Kept distinct from radius.button (4px vs 5px) until they are deliberately unified. | **Deleted** (merged into radius.button). |
| `shadow.sombra-blanco` | Figma effect 'Sombra /Blanco' (#59491E29). Colour kept as rgba(...,0.16) rather than 8-digit hex (alpha 0x29 = 0.1608) so rendering stays pixel-identical to the original CSS. | Warm-tinted elevation shadow: 0 4 8, rgba(89,73,30,0.16). Referenced by shadow.on-light. |
| `shadow.sombra-negro` | Figma effect 'Sombra /Negro' (#00000029). Colour kept as rgba(0,0,0,0.16) for pixel parity with the original CSS. | Neutral elevation shadow: 0 4 8, rgba(0,0,0,0.16). Referenced by shadow.on-dark. |
| `gradient.hero` | Hero background: diagonal gradient from dark (top-right) to brand orange (bottom-left). Use only for the page hero/header. Figma: 'Linear BG'. Angle 207.8deg is stored in $extensions because DTCG gradients have no angle; Figma stops/angle are still unverified (AUDIT §11). | Hero background only: dark at the top-right to orange at the bottom-left. The dark stop runs to 65% so lead text keeps at least 5.8:1 contrast; do not reuse elsewhere. |
| `text.heading-lg` (group) | Page and section headings (h1, h2). Mobile 24/26 is applied now; tablet+ 40/42 is defined for Phase 5 and not yet applied. Both bold 700. Figma: 'H1 Mobile' / 'H1 Tablet+'. | Headings (h1, h2). 24/26 bold below 930px, 40/42 bold from 930px; the base variables switch automatically. |
| `text.heading-lg.mobile` | Heading at viewport < 930px. Use for h1/h2. | Heading size below 930px. Use through the base tokens, not directly. |
| `text.heading-lg.tablet` | Heading at viewport ≥ 930px (Phase 5; not applied yet). | Heading size from 930px up. Applied automatically; do not reference directly. |
| `text.lead` (group) | Lead/subtitle paragraph placed directly under a heading. Mobile 14/18 is applied now; tablet+ 20/24 defined for Phase 5. Both medium 500. Figma: 'H2 Mobile' / 'H2 Tablet+' (it is a paragraph style, not an h2). | Lead paragraph under a heading. 14/18 medium below 930px, 20/24 medium from 930px; the base variables switch automatically. |
| `text.lead.mobile` | Lead paragraph at viewport < 930px. | Lead size below 930px. Use through the base tokens, not directly. |
| `text.lead.tablet` | Lead paragraph at viewport ≥ 930px (Phase 5; not applied yet). | Lead size from 930px up. Applied automatically; do not reference directly. |
| `text.lead-tight` | Legacy variant of text.lead with a tighter 16px line-height, used only by the exchange-section lead. Candidate to merge into text.lead; kept separate now for pixel parity. | **Deleted** (merged into text.lead). |
| `text.body-sm` | Small running text inside cards and lists: feature-card body, plan title, footer link list. Same values as text.lead.mobile but does NOT scale at tablet+. | Small running text inside cards and lists: card body, plan title, footer links. 14/18 medium at every width. |
| `text.button` | Label of any button or CTA link. Bold 14/18. (The hero link uses only size and weight; its line-height is left to the browser to keep the original rendering.) | Label of every button and link-button. Bold 14/18. |
| `text.caption` | Small supporting text: date chips, badges, price currency symbol, savings note. Light 300 / 12/15. Some uses take only the size. | Small supporting text: chips, price currency symbol, savings note. Regular 12/15 (D6). |
| `text.badge` (new, if D6 adopts Figma) | — | Label of solid badges. Inter bold 12, as drawn in Figma. |
| `font.body` / `font.data` / `radius.*` / other colours | unchanged | unchanged (no process notes) |

---

## 5. Components and cleanup

### 5a. Remove SectionTitle's `gap` and `tightLead`

- **Gap.** One value: `space.24` between heading and lead. Figma uses 24 in every section; the hero's 32 is the exception (D7).
- **Today's gaps:** 25 (hero), 30 (exchange, plans) and 20 (detail). Those become −1, −6 and +4. The hero ends 8px tighter than Figma's 32; that difference is reported here, not hidden.
- **`tightLead`:** goes away with `text.lead-tight` (§3.3).
- **After removal.** The component's props are `title`, `lead`, `level`, `tone`. The space after the block (today's 30 / 20 / 50) moves to page-level wrappers only, using scale values. The sizes line up with Figma's tablet gaps of 48 (exchange, plans) and 40 (detail).
- **Tablet+.** The component also gains the 466px measure.

### 5b. Badge renders `<span>`

- `<span>` replaces `<p>`: a chip or badge is not a paragraph.
- The `md` chip needs `display: block; margin-inline: auto`, and `sm` keeps its flex wrapper.
- Expected visual diff: 0 px.

### 5c. Strings out of components

- **CurrencyTable:** new props `trendLabels: { up: string; down: string }` and `updatedLabel: string`, supplied per table in `currencies.json`. Both are currently hard-coded Spanish ("Al alza", "A la baja", "Actualizado").
- **PlanCard:** new prop `ctaAriaLabel`, supplied per plan in `plans.json`. The hard-coded "plan:" in `${ctaLabel} plan: ${title}` is removed. Example value: "Escoger el plan Pago Mensual".
- Components then contain no user-facing Spanish.

### 5d. Centre the hero CTA properly

- **Remove** `left: calc(50% - 118px)`, `top: 270px` and `margin-top: 35px`.
- **New layout:** the header is `position: relative`; the CTA wrapper is `position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; transform: translateY(50%)`.
- **Why:** this centres the button on the hero's bottom edge, which is exactly how Figma tablet places it (button 509–557 on a background ending at 533).
- **Visual effect (intentional):** horizontally +3.5px, because today's `calc` is off-centre; vertically about +5px lower. The 24px overhang is covered by the main section's 80px top padding.
- **Also:** the hero uses `min-height` (334 mobile, 480 from 930px) and drops the fixed 218px title container.

### 5e. Fonts, language, title, brand name

**Fonts.** Used vs loaded:

| Family | Loaded now | Actually used | Result today |
|---|---|---|---|
| DM Sans | 400, 500, italic 700 | 400, 500, 700 upright (headings, buttons, price), 300 (caption) | upright 700 is synthesized; 300 renders as 400 |
| Inter | 300, 500 | 400 (cells), 700 (table title) | neither used weight is loaded; 400 renders as 500, 700 is synthesized |

- **New link:** `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;700&display=swap`, plus `rel="preconnect"` for `fonts.googleapis.com` (only gstatic has one now).
- **Intentional rendering change:** headings and prices become true bold, and table cells go from medium to regular. Advance widths differ slightly, so some lines may reflow. This is how Figma draws them.
- **D6:** `font.weight.light` (300) would need its own file. Instead, make `text.caption` regular (400), which is what renders today, and set `strong { font-weight: var(--font-weight-bold) }` explicitly. Today the chip's `<strong>` computes to 400 (bolder than 300 is 400), so "Actualizado" is visually not bold. After the change it is. Confirm that is wanted.
- **Badge typography:** Figma's badge label is **Inter Bold 12**; code uses DM Sans. Recommendation: add `text.badge` (Inter bold 12, already loaded) so code adopts Figma. Say if you'd rather change Figma.

**`lang`, title, name.**
- `<html lang="es">` (currently `en`).
- `<title>`: "Batatabit | Precios de criptomonedas en tiempo real" (currently "Document"). A `<meta name="description">` can follow the hero lead.
- **"Batatabit" everywhere:** four wrong spellings in code, all in content:
  - `features.json:10` "Batabit"
  - `features.json:15` "Babtabit"
  - `index.astro:20` hero lead "Batabit"
  - `index.astro:84` footer logo alt "Logo de Batatabit 2020", correct spelling but noisy
- The header logo's `alt=""` becomes `alt="Batatabit"`, and the footer alt becomes "Batatabit". `tokens.json` line 2 says "BatataBit" and becomes "Batatabit". The package and repo name `batatabit` stay.

### 5f. Delete unreferenced assets

All are recoverable from tag `v3-components`. Verified by grepping `src/`:

| File | Size |
|---|---|
| `public/assets/img/bitcoinbaby2x.png` | 690,392 B |
| `public/assets/img/bitcoinbaby.png` | 183,805 B |
| `public/assets/img/bitcoinbaby.jpg` | 134,287 B |
| `public/assets/icons/check-circle.svg` | 703 B |
| `public/assets/icons/dollar-sign.svg` | 618 B |
| `public/assets/icons/eye.svg` | 474 B |
| `public/assets/icons/clock.svg` | 436 B |
| `public/assets/icons/orange-right-arrow.svg` | 316 B |
| `public/assets/icons/trending-down.svg` | 311 B |
| `public/assets/icons/trending-up.svg` | 303 B |
| `public/assets/icons/down-arrow.svg` | 222 B |
| `public/assets/icons/right-arrow.svg` | 203 B |
| **Total (12 files)** | **1,012,070 B ≈ 988 KiB** |

Kept (referenced): `Bitcoin.svg` 58,160 B, `bitcoinbaby2x.jpg` 481,102 B, `logo.svg` 6,795 B, `logo-footer.svg` 12,712 B, `batata.svg` 804 B.

---

## 6. Figma checklist (apply before Phase 5b)

Names follow `tokens.json`. Values marked "unchanged" only need the rename or binding.

### Colour variables
- [ ] Rename Bitcoin Orange → `color/primary` (`#F7931A`, unchanged).
- [ ] Rename Soft Orange → `color/primary-soft` (`#FFE9D4`, unchanged).
- [ ] Rename Secondary Blue → `color/secondary` (`#1A9AF7`, unchanged).
- [ ] Rename Soft Blue → `color/secondary-soft` (`#E7F5FF`, unchanged).
- [ ] Rename Warm Black → `color/surface-dark` (`#201E1C`, unchanged); also use it for `color/text-strong`, `color/on-button`, `color/on-primary` and `color/on-secondary`.
- [ ] Rename Warm Black+1 → `color/surface-dark-raised` and `color/text-on-soft` (`#282623`, unchanged).
- [ ] Rename Off White → `color/surface-page` and `color/surface-button` (`#FAF8F7`, unchanged).
- [ ] Rename Just White → `color/surface-card` and `color/text-on-dark` (`#FFFFFF`, unchanged).
- [ ] **Delete** Grey (`#BABABA`); it fails contrast as text and nothing replaces it.
- [ ] **Add** `color/text-muted` = `#6E6E6E`.
- [ ] **Add** `color/text-muted-on-dark` = `#929292`.
- [ ] **Add** `color/on-primary` = `#201E1C`.
- [ ] **Add** `color/on-secondary` = `#201E1C`.
- [ ] **Add** `color/on-button` = `#201E1C`.
- [ ] **Add** `color/border-accent` = `#CF7407`.
- [ ] **Add** `color/trend-up` = `#05A629` and `color/trend-down` = `#F5450D`.
- [ ] **Update** Linear BG: dark stop `#201E1C` at **65%**, orange `#F7931A` at 100%; confirm the angle is 207.8° (stops and angle could not be read from the file via MCP).

### Effects
- [ ] Rename Sombra /Blanco → `shadow/on-light` (0, 4, 8, `#59491E29`, unchanged).
- [ ] Rename Sombra /Negro → `shadow/on-dark` (0, 4, 8, `#00000029`, unchanged).

### Text styles
- [ ] H1 Mobile and H1 Tablet+ → one `text/heading-lg` with two modes: 24/26 and 40/42, DM Sans Bold (unchanged).
- [ ] H2 Mobile and H2 Tablet+ → one `text/lead` with two modes: 14/18 and 20/24, DM Sans Medium (unchanged).
- [ ] **Create** styles for text that exists but is unstyled today: `text/body-sm` (14/18 Medium), `text/button` (14/18 Bold), `text/title-md` (Inter 18/23 Bold), `text/title-sm` (18/18 Bold), `text/data` (Inter 16/19 Regular), `text/caption` (DM Sans 12/15 Regular), `text/price` (52/53 Bold).
- [ ] **Create** `text/badge` (Inter 12 Bold) if D6 adopts Figma.

### Components / layers
- [ ] **Buttons (hero and plan):** bind fill to `color/surface-button`, label and arrow to `color/on-button`; radius 4 is already correct. Plan button border → `color/border-accent`.
- [ ] **Badge "Highlight" (Recomendado):** text fill white → `color/on-primary`. Add a blue variant (fill `color/secondary`, text `color/on-secondary`) for "Más vendido".
- [ ] **Table titles:** change from coloured text to `color/text-strong`, add a 4×32px accent bar (`color/primary` for "Monedas", `color/secondary` for "Comisiones").
- [ ] **Table cells:** label column → `color/text-muted`, value column → `color/text-strong`. Cell padding-x stays 12 (matches the 8/12/16 scale).
- [ ] **Footer links:** white → `color/on-primary`.
- [ ] **Trend icons:** up → `color/trend-up`; down → `color/trend-down`.
- [ ] **Hero:** gradient per above; heading→lead gap 32 → 24 (or confirm D7); background height 480 on tablet; button centred on the bottom edge (already so on tablet).
- [ ] **Radii (D4):** verify or set plan card 15 vs 8 and feature card 5 vs 4 (Figma currently 8 and 4); read the table grid's radius, which was not in this read.
- [ ] **Spacing variables:** create `space/4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80` and bind the existing paddings, gaps and margins (button 16/12, gap 8, badge 8, section gaps 24/32/40/48).
- [ ] **Frames:** rename "iPad Pro 11" - 1" to something that states its breakpoint, and decide D5 (834 vs 930).

### Copy
- [ ] Replace "Batabit" and "Babtabit" with "Batatabit": feature 2 body, feature 3 body, and the first FAQ question.
- [ ] Table chips read "Valores en $ USD" in Figma but "Actualizado: 19 Julio 23:45" in code; decide which copy wins.
- [ ] Hero and chip text colours stay as listed above; no other text colour changes.

---

*Method.* Contrast: WCAG 2.x luminance formula with hue-preserving search for the minimal passing colour. Hero gradient: Playwright renders the page with text transparent and samples every background pixel under the actual line boxes, at nine widths. Spacing mapping: applied mechanically to a throwaway copy and rebuilt. Tablet type: injected CSS at 930 and 1024px. Figma: `get_variable_defs`, `get_design_context` for nodes 362:25, 364:80, 364:85, 364:38, 364:74 and `get_metadata` for 359:319. The measurement scripts live in the session scratchpad and are not committed; say if you want them added under `scripts/`.

---

## 7. Phase 5b change list driven by Figma (running; updated after Figma batch 3)

Rule from the Figma work: values bound to Figma styles or variables are design decisions (Figma is canonical); content follows code. Frames at 768px and above use the Typography `tablet` mode, so the code breakpoint becomes **768px** (D5), not 930px.

**Pending decisions (not yet applied in Figma):**
- Table value size: keep Figma's 14 (`text/data-value`) or change Figma to 16 to match the labels.
- Price tracking: accept -8% on `text/price` or remove it.
- Gradient stop: Figma has `#201E1C` at 11.19%; code has 16.69%. Check Dev Mode CSS on node `359:484`, then decide whether code moves. The hero lead (`#FFE9D4`) on this gradient is 2.98:1, a documented brand exception; no other text goes on it.

**Colour tokens** (Figma collections `Primitives` and `Color`):
- `neutral.600` → `#6E6E6E`, `neutral.500` → `#929292`; new primitives `orange.600` `#CF7407`, `green.600` `#05A629`.
- New semantic tokens: `surface-button`, `on-button`, `on-secondary`, `border-accent`. `on-primary` → `neutral.900`. `trend-up` → `green.600`. Delete `text-subtle`.
- `gradient.hero` description states the 2.98:1 exception (see above).

**Typography** (Figma collection `Typography`, modes `mobile` and `tablet`; text styles `text/*`):
- Heading-lg 24/26 → 40/42 and lead 14/18 → 20/24, switching at 768px.
- Families: Inter for data, numbers and small labels (price, caption, badge, note, table cells); DM Sans for headings and running text, including table titles. Write this rule into the `font.body` and `font.data` descriptions.
- Load **Inter 400, 500 and 700** and DM Sans 500 and 700 (Inter 500 is new; DM Sans 400 only if something still needs it).
- Changes against code:

| Token | Figma value | Code today |
|---|---|---|
| `text.data` → split | `data-label` Inter Medium 16/19, -2%; `data-value` Inter Regular 14/17, -2% (size pending) | one `text.data` Inter Regular 16/19 |
| `text.title-md` | DM Sans Bold 18/23 | Inter Bold 18/23 |
| `text.price` | Inter Bold 52/63, -8% (tracking pending) | DM Sans Bold 52/53 |
| `text.note` (new) | Inter Medium 12/15 | DM Sans 12, no weight |
| `text.caption` | Inter Regular 12/15 | DM Sans Light 300, 12/15 |
| `text.badge` (new) | Inter Bold 12/15 | DM Sans 12 |
| `text.button` | DM Sans Bold 14/18 | DM Sans Bold 14/18 (hero link left line-height unset) |

- Explicit line heights now set in Figma: button 18, title-md 23, data-label 19, data-value 17, caption 15, note 15, badge 15, price 63.

**Spacing:** 4px scale `space/4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80` as Figma variables (scope Gap), matching the code tokens.

**Added after Figma batch 4 (tablet frame):**
- **Alias swap (approved; Figma's styles are canonical):** `color.text-strong` aliases `neutral.900` (`#201E1C`, was `neutral.800`) and `color.text-on-soft` aliases `neutral.800` (`#282623`, was `neutral.900`). Figma's headings, table titles and values use Warm Black, and its chip text uses Warm Black+1.
- **Contrast values that change:** `text-strong` is 15.69:1 on off-white and 16.62:1 on white (was 14.25 and 15.09). `text-on-soft` is 12.83:1 on `primary-soft` and 13.58:1 on `secondary-soft` (was 14.13 and 14.96). All still pass AA.
- **Descriptions to update:** `text-strong` and `text-on-soft` (old and new text in §4.2).
- **Radii from Figma:** plan card 8, table grid 8 on the outer corners (code has 15), feature card 4 (code 5), buttons 4, badges and chips 8. So `radius.card` → 8 for plan cards and tables, `radius.card-compact` → 4, `radius.button` → 4.
- **Plan cards:** all three look the same except the badge (no ghosted state); prices, "$" and titles use `text-strong`, notes use `text-muted`.
- **Table titles:** `text-strong` with a 32×4 accent bar in `color.primary` / `color.secondary` (D1).
- **Footer:** links and © use `color.on-primary`; the © line is `text.body-sm` (Figma had a scaled 17.8px text).

**Added after Figma batch 5 (copy):** Figma now follows code for the chip text ("Actualizado: 19 Julio 23:45", bold word and regular rest), the plan cards (Pago Mensual $19, Pago Anual $99, Pago Diario $17, with their notes) and the desktop lead (no "del mercado"). "Batatabit" is spelled correctly everywhere in the seven frames, including the browser-mock tab title and URL.
- **Content differences, resolved (last Figma pass):** code wins. The dark section in Figma now reads "Creamos un producto sin comparación." / "Confiable y diseñado para su uso diario." on the tablet and both phone frames that have it. The blue "Más vendido" badge (`color/secondary` fill, `color/on-secondary` text) was added to the Pago Mensual card on the tablet frame, the only frame with a Pago Mensual card (the phone frames show only the featured Pago Anual card). It is a copy of the Recomendado frame, not a component.
- **FAQ section:** it stays in Figma and is **not to be implemented in code**; it is reserved as the live-demo task. Each FAQ heading carries the Figma annotation "Designed, not yet implemented in code." (tablet, iPhone 8 - 1, iPhone 8 - 2, iPhone SE). Phase 5b must leave it out of `index.astro`.
- **Code still to fix in 5b:** the misspellings "Batabit" (hero lead in `index.astro`, `features.json` body 2) and "Babtabit" (`features.json` body 3).

---

## 8. Phase 5b record (code applied, tag `v4-fixes`)

Everything in §7 was applied in code. Decisions made while doing it:
- **Gradient stop:** left at 16.69%. The Dev Mode check on node `359:484` (Figma's raw first stop is 11.19%) is still open, so no value was changed. The hero lead stays `#FFE9D4`; measured live it is 3.03:1 at worst, the one documented contrast exception.
- **Image heading:** "Conócelo hoy." failed contrast on the photo (1.76 to 2.79:1, large text needs 3:1). Fixed with `gradient.image-scrim` (55% `surface-dark` fading out at 75% of the height); the heading is now 3.65:1 or better. This scrim is **not in Figma yet**.
- **Button:** now centres its content in a flex row with an 8px gap and a 16px side padding. The outline button is `min-width: 150px` with no wrapping, so it hugs a longer label.
- **Table title:** same width as the grid, left-aligned, with the accent bar underneath.
- **Plan card:** the note reserves two lines so the buttons line up across cards; the "$" no longer has a space before the price (as in Figma).
- **`astro check`:** the Icon typing error present since Phase 3 is fixed; earlier checks filtered the singular "1 error" line out.

---

## 9. Phase 5c record (layout parity with Figma "Tablet ≥768" at 834px; not tagged yet)

Applied in code, tokens only: hero logo at 104px from the top (Figma 103) through `layout.hero-padding-top` (64px at tablet) and the new `layout.hero-logo-margin-top` (40px at tablet); the two tables side by side, centred, 24px apart and fitted to their content; table chips left-aligned under the table; plan cards as three equal columns inside a 64px margin with 16px gaps (224.7px wide against Figma's 223px); footer content on the 466px title measure (links at its left edge, logo at its right edge); the batata icon removed (it exists in no Figma frame except the logos).

Waiting on decisions: the Dev Mode CSS of node `359:484` (gradient stop), approval of the image scrim before it is added to Figma, and Figma's hero heading-to-lead gap (32px in Figma against the 24px of decision D7).

Remaining differences against Figma at 834px: table column widths (Figma 100/106px, not on the scale; code hugs the content: 189.7 and 171.8px against 218 and 208px) and row heights (Figma 39px; code rows stretch to a 250px grid); feature cards (Figma 345px wide inside the 64px margin; code 400px with a 16px margin); footer height (Figma 271px; code 150px); hero logo size (Figma 174×27.7px; code 150×24px, so the h1 starts 3.6px higher); heading-to-lead gap in the hero (Figma 32px; code 24px).
