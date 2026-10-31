# SectionTitle

## Purpose

A heading with an optional lead paragraph, coloured for the surface it sits on.

## When to use

- For the hero heading (`level={1}`, `tone="on-gradient"`) and for every section heading (`level={2}`).
- When a heading needs a one-sentence lead under it.

## When NOT to use

- For titles inside cards: `FeatureCard` and `PlanCard` render their own `<h3>`.
- For a table title: `CurrencyTable` renders its own.
- For body copy: use a paragraph styled with `text.body-sm`.

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `title` | `string` | — | Yes | Heading text. |
| `lead` | `string` | none | No | Lead paragraph rendered under the heading. |
| `level` | `1 \| 2` | — | Yes | Heading level: `1` renders an `<h1>` (once per page, the hero), `2` renders an `<h2>` (sections). Both look identical. |
| `tone` | `"on-light" \| "on-dark" \| "on-gradient"` | — | Yes | Surface the title sits on, which picks the text colours. |

## Variants

| Tone | Heading | Lead | Use on |
|---|---|---|---|
| `on-light` | `color.text-strong` | `color.text-muted` | The page background. |
| `on-dark` | `color.text-on-dark` | `color.text-muted-on-dark` | Dark sections and photos. |
| `on-gradient` | `color.text-on-dark` | `color.primary-soft` | The hero only (see the documented contrast exception in the design system overview). |

## Tokens used

`color.text-strong`, `color.text-muted`, `color.text-on-dark`, `color.text-muted-on-dark`, `color.primary-soft`, `text.heading-lg`, `text.lead`, `layout.title-measure`, `space.24`.

## Accessibility

- Use one `level={1}` per page and `level={2}` for sections, so the outline stays in order; cards then use `<h3>`.
- The block is centred and limited to `layout.title-measure` (the full width below 768px, 466px from 768px).
- Contrast: `on-light` is 15.69:1 (heading) and 4.82:1 (lead) on the page background (`color.surface-page`); `on-dark` is 16.62:1 and 5.34:1 on `color.surface-dark`. The `on-gradient` lead is 3.03:1 at worst, the one documented exception.

## Examples

The hero title:

```astro
<SectionTitle
  level={1}
  tone="on-gradient"
  title="La próxima revolución en el intercambio de criptomonedas."
  lead="Batatabit te ayuda a navegar entre los diferentes precios y tendencias."
/>
```

A section on the page background:

```astro
<SectionTitle
  level={2}
  tone="on-light"
  title="Escoge el plan que mejor se ajuste a ti."
  lead="Cualquier plan te da acceso completo a nuestra plataforma."
/>
```

A heading without a lead, on a photo:

```astro
<SectionTitle level={2} tone="on-dark" title="Conócelo hoy." />
```

## Do / Don't

- Do choose `tone` from the surface. Don't pass colours, sizes or classes.
- Do keep the title short; it wraps at the 466px measure on tablet. Don't put markup in it.
- Do use a single `level={1}`. Don't skip heading levels.
- Don't place other text on the hero gradient; only this component's lead may sit there.
