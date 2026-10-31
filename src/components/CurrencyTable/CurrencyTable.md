# CurrencyTable

## Purpose

A two-column data table (name and value, with an optional trend icon) under a title and an update chip.

## When to use

- To show a short list of named values such as currencies or exchange fees.
- When a value may carry a direction of change (up or down).

## When NOT to use

- For layout or for a list of features: use [FeatureCard](../FeatureCard/FeatureCard.md) or a list.
- For tables with more than two columns: this component is a fixed two-column grid.
- For a standalone date or status label: use [Badge](../Badge/Badge.md).

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `title` | `string` | — | Yes | Table title, rendered as an `<h3>` and used as the accessible name of the table. |
| `tone` | `"primary" \| "secondary"` | — | Yes | Colour of the accent bar under the title and of the date chip. The title text is always dark. |
| `columns` | `{ label: string; value: string }` | — | Yes | Visually hidden column headers for screen readers, for example "Moneda" and "Valor". |
| `rows` | `Row[]` | — | Yes | Table rows. The first column is the row header, the second the data cell. |
| `trendLabels` | `{ up: string; down: string }` | — | Yes | Text alternatives of the trend icons, for example "Al alza" and "A la baja". |
| `updatedLabel` | `string` | — | Yes | Bold word that starts the update chip, for example "Actualizado". |
| `updatedAt` | `string` | — | Yes | Last-update text shown in the chip after the label, for example "19 Julio 23:45". |

### Row

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | First-column text: the name of the currency or exchange. |
| `value` | `string` | Yes | Second-column text, already formatted (for example "$ 1.96"). |
| `trend` | `"up" \| "down"` | No | Direction of the latest change, shown as an icon after the value. |

## Variants

| Tone | Intended use |
|---|---|
| `primary` | The main table (orange accent bar and chip). |
| `secondary` | The second table next to it (blue accent bar and chip). |

## Tokens used

`color.text-strong`, `color.text-muted`, `color.primary`, `color.secondary`, `color.surface-card`, `color.trend-up`, `color.trend-down`, `radius.card`, `border.divider`, `space.4`, `space.8`, `space.12`, `space.16`, `space.20`, `space.32`, `text.title-md`, `text.data-label`, `text.data-value`. The chip also uses the tokens of [Badge](../Badge/Badge.md).

## Accessibility

- A real `<table>` with explicit ARIA roles (`rowgroup`, `row`, `columnheader`, `rowheader`, `cell`) so the semantics survive the grid layout, labelled by its `<h3>` title through `aria-labelledby`.
- The column headers are visually hidden but read by screen readers; the first column cells are row headers.
- Trend icons are exposed as images with the text from `trendLabels`; direction is never shown by colour alone.
- Contrast: names use `color.text-muted` (5.10:1 on white), values use `color.text-strong` (16.62:1 on white), the up icon is 3.23:1 and the down icon 3.66:1 on white.
- Layout: below 768px the table is 70% of its container; from 768px it fits its content and the page places the tables side by side. Rows are 39px.

## Examples

Rendering the data file:

```astro
{currencies.map((table) => <CurrencyTable {...table} />)}
```

One table's data (`src/data/currencies.json`):

```json
{
  "title": "Monedas",
  "tone": "primary",
  "columns": { "label": "Moneda", "value": "Valor" },
  "trendLabels": { "up": "Al alza", "down": "A la baja" },
  "updatedLabel": "Actualizado",
  "updatedAt": "19 Julio 23:45",
  "rows": [
    { "label": "Bitcoin", "value": "$ 1.96", "trend": "down" },
    { "label": "Ethereum", "value": "$ 0.07", "trend": "up" }
  ]
}
```

A table without trends:

```astro
<CurrencyTable
  title="Comisiones"
  tone="secondary"
  columns={{ label: "Casa de cambio", value: "Comisión" }}
  trendLabels={{ up: "Al alza", down: "A la baja" }}
  updatedLabel="Actualizado"
  updatedAt="19 Julio 23:45"
  rows={[{ label: "Bitrade", value: "$ 12.96" }]}
/>
```

## Do / Don't

- Do put the content in `src/data/currencies.json`. Don't hard-code rows in the page.
- Do pass translated `trendLabels` and `updatedLabel`. Don't rely on the icon colour to show direction.
- Do format `value` before passing it. Don't pass numbers or raw colours.
- Do use `tone` to pick the accent. Don't colour the title text.
