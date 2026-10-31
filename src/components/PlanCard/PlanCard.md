# PlanCard

## Purpose

A pricing card for one plan: title, price, a short note, an optional badge and a call-to-action button.

## When to use

- To present purchasable plans side by side, each with a price and one action.
- To flag one plan with a badge ("Recomendado", "Más vendido").

## When NOT to use

- For product benefits without a price: use [FeatureCard](../FeatureCard/FeatureCard.md).
- For tabular values: use [CurrencyTable](../CurrencyTable/CurrencyTable.md).
- For a standalone call to action: use [Button](../Button/Button.md).

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `title` | `string` | — | Yes | Plan name, rendered as an `<h3>`. Place the card under an `<h2>` section title. |
| `price` | `number` | — | Yes | Price in dollars, shown large with a small "$" prefix. |
| `note` | `string` | — | Yes | Small supporting note under the price: what the plan includes or saves. |
| `badge` | `{ label: string; tone: "primary" \| "secondary" }` | none | No | Highlight pinned to the top edge of the card. The tone must be a solid one. |
| `ctaLabel` | `string` | — | Yes | Visible label of the call-to-action button, for example "Escoger este". |
| `ctaAriaLabel` | `string` | — | Yes | Accessible name of the button. Must contain `ctaLabel` and name the plan, for example "Escoger el plan Pago Mensual". |

## Variants

| Badge | Intended use |
|---|---|
| none | A regular plan. |
| `tone: "primary"` | The recommended plan ("Recomendado"). |
| `tone: "secondary"` | The best-selling plan ("Más vendido"). |

Below 768px the cards form a horizontally scrolling row (each about 70% wide); from 768px the cards share the width equally inside the page margin.

## Tokens used

`color.surface-card`, `color.text-strong`, `color.text-muted`, `radius.card`, `shadow.on-light`, `space.4`, `space.16`, `space.20`, `space.32`, `space.48`, `text.body-sm`, `text.price`, `text.note`. The badge and the button use the tokens of [Badge](../Badge/Badge.md) and [Button](../Button/Button.md).

## Accessibility

- Renders an `<article>` with an `<h3>` title.
- The button's accessible name comes from `ctaAriaLabel`, so three "Escoger este" buttons stay distinguishable and still contain their visible text (WCAG 2.5.3).
- Contrast: title and price use `color.text-strong` (16.62:1 on white); the note uses `color.text-muted` (5.10:1 on white).
- Below 768px the cards sit in a horizontally scrolling row that is not focusable itself; keyboard users reach every card through its button, which scrolls the card into view.

## Examples

Rendering the data file:

```astro
{plans.map((plan) => <PlanCard {...plan} />)}
```

A plan with a badge (`src/data/plans.json`):

```json
{
  "title": "Pago Anual",
  "price": 99,
  "note": "*Ahorras $129 comparado al plan mensual.",
  "badge": { "label": "Recomendado", "tone": "primary" },
  "ctaLabel": "Escoger este",
  "ctaAriaLabel": "Escoger el plan Pago Anual"
}
```

A plan without a badge:

```astro
<PlanCard
  title="Pago Diario"
  price={17}
  note="*Acceso a servicios Pro durante un dia"
  ctaLabel="Escoger este"
  ctaAriaLabel="Escoger el plan Pago Diario"
/>
```

## Do / Don't

- Do keep the notes to about two lines; the note area reserves two lines so buttons align. Don't write paragraphs.
- Do pass a number for `price`. Don't include the "$" sign in it.
- Do give each card a distinct `ctaAriaLabel`. Don't reuse the same one.
- Do put the plans in `src/data/plans.json`. Don't hard-code them in the page.
