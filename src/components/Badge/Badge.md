# Badge

## Purpose

A small inline label that marks a card ("Recomendado") or states a short fact in a pill (the "Actualizado" date chip).

## When to use

- To label a card from its top edge: a solid badge (`tone="primary"` or `"secondary"`, `size="sm"`) on a plan card.
- To show a short informational pill under a data table: a soft chip (`tone="primary-soft"` or `"secondary-soft"`, `size="md"`).

## When NOT to use

- For anything clickable: use [Button](../Button/Button.md).
- For the direction of a price change: use [Icon](../Icon/Icon.md) with a `label` (`trending-up` / `trending-down`).
- For running text or notes: use a paragraph styled with `text.caption` or `text.note`.
- For a text colour: pick a semantic colour token instead of recreating a badge.

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `tone` | `"primary" \| "secondary" \| "primary-soft" \| "secondary-soft"` | — | Yes | Colour scheme. `primary` and `secondary` are solid fills with dark text (promotional badges); `primary-soft` and `secondary-soft` are tinted fills with dark text (informational chips). |
| `size` | `"sm" \| "md"` | `"md"` | No | Typography. `sm` is the bold label (`text.badge`) for badges on cards; `md` is regular text (`text.caption`) for chips, where a `<strong>` inside takes the bold badge style. |

The default slot holds the label text.

## Variants

| Tone | Size | Intended use |
|---|---|---|
| `primary` | `sm` | Highlight on the recommended plan ("Recomendado"). |
| `secondary` | `sm` | Highlight on the best-selling plan ("Más vendido"). |
| `primary-soft` | `md` | Date chip under the orange table ("Actualizado: 19 Julio 23:45"). |
| `secondary-soft` | `md` | Date chip under the blue table. |

## Tokens used

`color.primary`, `color.secondary`, `color.primary-soft`, `color.secondary-soft`, `color.on-primary`, `color.on-secondary`, `color.text-on-soft`, `radius.chip`, `space.8`, `text.badge`, `text.caption`.

## Accessibility

- Renders a `<span>` (`display: block`, sized to its content): it is inline text, not a paragraph and has no role.
- The label must make sense on its own; colour never carries the meaning.
- Contrast: `color.on-primary` on `color.primary` is 7.23:1, `color.on-secondary` on `color.secondary` is 5.55:1, `color.text-on-soft` on the soft tones is 12.83:1 and 13.58:1.

## Examples

A badge pinned to a card (this is what `PlanCard` renders):

```astro
<Badge tone="primary" size="sm">Recomendado</Badge>
```

A date chip with a bold word:

```astro
<Badge tone="primary-soft"><strong>Actualizado</strong>: 19 Julio 23:45</Badge>
```

A solid blue badge:

```astro
<Badge tone="secondary" size="sm">Más vendido</Badge>
```

## Do / Don't

- Do pick the look with `tone` and `size`. Don't pass colours, classes or inline styles: the component has no override props by design.
- Do keep the label to a few words. Don't put paragraphs or links inside.
- Do use a soft tone with `size="md"` for chips. Don't use a solid tone with dark text on a dark surface.
