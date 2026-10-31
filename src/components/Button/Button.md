# Button

## Purpose

The single button component: a call to action that either navigates (a link) or triggers an in-page action.

## When to use

- A primary call to action on a gradient or light surface: `variant="light"`, usually as a link to a section.
- A secondary action inside a card, such as choosing a plan: `variant="outline"`.

## When NOT to use

- For plain text links in running text or lists: use a normal `<a>` styled by the page (for example the footer links).
- For labels, tags or status: use [Badge](../Badge/Badge.md).
- For toggles, tabs or form controls: no component exists for them yet; do not repurpose Button.

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `variant` | `"light" \| "outline"` | — | Yes | Visual style. `light` is the filled button with a shadow (229px wide); `outline` has an accent border for secondary actions (at least 150px wide). |
| `icon` | `"arrow-down" \| "arrow-right"` | none | No | Optional trailing icon. Decorative; the label must carry the meaning. |
| `ariaLabel` | `string` | none | No | Accessible name override for labels that are ambiguous out of context. Keep the visible label inside it. |
| `as` | `"a" \| "button"` | `"button"` | No | Element to render: `a` for navigation (requires `href`), `button` for in-page actions (rendered with `type="button"`). |
| `href` | `string` | — | Yes, when `as="a"` | Link target, for example `#plans`. Not allowed with `as="button"`. |

The default slot holds the visible label.

## Variants

| Variant | Intended use |
|---|---|
| `light` | The hero call to action. Surface-coloured fill, shadow, centred label, `arrow-down` icon. |
| `outline` | Secondary actions on cards. Same fill with a 2px accent border and an `arrow-right` icon in the brand colour. |

## Tokens used

`color.surface-button`, `color.on-button`, `color.border-accent`, `color.primary`, `radius.button`, `shadow.on-light`, `border.button`, `space.8`, `space.16`, `text.button`.

## Accessibility

- `as="a"` renders an `<a href>`; `as="button"` renders `<button type="button">`. Use the element that matches the behaviour.
- The icon is `aria-hidden`; the visible label is the accessible name unless `ariaLabel` is set.
- When several buttons share a label, give each an `ariaLabel` that contains the visible text and names the target (WCAG 2.5.3, Label in Name).
- Contrast: `color.on-button` on `color.surface-button` is 15.69:1. The accent border (`color.border-accent`) is 3.41:1 on white and 3.22:1 on off-white, above the 3:1 needed for a component boundary.
- Focus uses the browser default; no custom focus style is defined.

## Examples

The hero call to action:

```astro
<Button variant="light" as="a" href="#plans" icon="arrow-down">Conoce Nuestros Planes</Button>
```

A plan button with a distinct accessible name (this is what `PlanCard` renders):

```astro
<Button variant="outline" icon="arrow-right" ariaLabel="Escoger el plan Pago Mensual">
  Escoger este
</Button>
```

An in-page action without an icon:

```astro
<Button variant="outline">Ver detalle</Button>
```

## Do / Don't

- Do use `as="a"` with an `href` for navigation. Don't render `as="a"` without `href`.
- Do keep the visible text inside `ariaLabel`. Don't replace the label with an unrelated phrase.
- Do choose `variant` for the look. Don't pass colours, classes or widths.
- Do place `light` on a surface where `color.on-button` text reads well. Don't use it as a tiny inline link.
