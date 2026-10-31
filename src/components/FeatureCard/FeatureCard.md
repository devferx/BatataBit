# FeatureCard

## Purpose

A compact card for a product feature: an icon, a short title and one or two sentences.

## When to use

- To list product benefits on a dark section, two per row from 768px.
- When each item needs an icon from the feature set (`clock`, `eye`, `dollar-sign`, `check-circle`).

## When NOT to use

- For prices or plans: use [PlanCard](../PlanCard/PlanCard.md).
- For tabular values: use [CurrencyTable](../CurrencyTable/CurrencyTable.md).
- On a light surface: its colours are designed for `color.surface-dark`.

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `icon` | `"clock" \| "eye" \| "dollar-sign" \| "check-circle"` | — | Yes | Glyph shown above the title. One of the Icon names that represent a feature. |
| `title` | `string` | — | Yes | Card title, rendered as an `<h3>`. Place the card under an `<h2>` section title. |
| `body` | `string` | — | Yes | Supporting sentence or sentences under the title. |

## Variants

None. The card has one look; the content changes through the props.

## Tokens used

`color.surface-dark-raised`, `color.text-on-dark`, `color.text-muted-on-dark`, `color.primary`, `radius.card-compact`, `shadow.on-dark`, `space.8`, `space.12`, `space.16`, `text.title-sm`, `text.body-sm`.

## Accessibility

- Renders an `<article>` with an `<h3>` title, so the section needs an `<h2>` above it.
- The icon is decorative (`aria-hidden`); the title carries the meaning.
- Contrast: titles use `color.text-on-dark` (15.09:1 on the card), body text uses `color.text-muted-on-dark` (4.85:1 on the card).

## Examples

Rendering the data file:

```astro
{features.map((feature) => <FeatureCard {...feature} />)}
```

One feature (`src/data/features.json`):

```json
{
  "icon": "clock",
  "title": "Tiempo real",
  "body": "Nuestro API toma información minuto a minuto sobre las tasas que más determinan el comportamiento."
}
```

Direct use:

```astro
<FeatureCard icon="check-circle" title="Información confiable" body="Nuestras fuentes están 100% verificadas." />
```

## Do / Don't

- Do keep the title to one line and the body to a few lines. Don't put links or buttons inside.
- Do place the cards inside the page's feature container. Don't set widths or margins on them.
- Do put the copy in `src/data/features.json`. Don't hard-code it in the page.
