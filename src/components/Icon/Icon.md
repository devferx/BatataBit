# Icon

## Purpose

An inline SVG icon that takes its colour from the text colour around it.

## When to use

- As a decorative glyph next to a label (feature icons, button arrows).
- As the direction indicator of a price change, with a `label`.

## When NOT to use

- For a logo or an illustration: use an `<img>` from `public/assets`.
- As the only way to convey information: always give a meaningful icon a `label`.
- For a new glyph that is not in the list: add its paths to the component instead of using a background image.

## Props

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `name` | `"clock" \| "eye" \| "dollar-sign" \| "check-circle" \| "arrow-right" \| "arrow-down" \| "trending-up" \| "trending-down"` | — | Yes | Which glyph to draw. |
| `size` | `"sm" \| "md"` | `"md"` | No | Rendered size: `sm` is 15px, `md` is 20px. Ignored by `arrow-down`, which is always 13×8. |
| `label` | `string` | none | No | Accessible name. When set, the icon is exposed as an image with this label; when omitted it is decorative. |

## Variants

| Names | Intended use |
|---|---|
| `clock`, `eye`, `dollar-sign`, `check-circle` | Feature icons, 20px outlines that inherit the surrounding colour (`color.primary` in feature cards). |
| `arrow-right`, `arrow-down` | Button arrows; they inherit the button's icon colour. |
| `trending-up`, `trending-down` | Direction of a price change. The colour is built in (`color.trend-up`, `color.trend-down`), size `sm`, always with a `label`. |

## Tokens used

`color.trend-up`, `color.trend-down`. Every other icon uses `currentColor` and takes the colour of its parent, so set the colour on the wrapper with a semantic colour token.

## Accessibility

- Without `label` the SVG is `aria-hidden` and not focusable.
- With `label` it gets `role="img"` and `aria-label`.
- Trend icons must always carry a `label`; colour alone is not enough.
- Contrast for graphics (3:1): the up icon is 3.23:1 and the down icon 3.66:1 on white.

## Examples

A decorative feature icon:

```astro
<Icon name="clock" />
```

A trend icon with a text alternative (as `CurrencyTable` renders it):

```astro
<Icon name="trending-down" size="sm" label="A la baja" />
```

A button arrow (as `Button` renders it):

```astro
<Icon name="arrow-right" />
```

## Do / Don't

- Do wrap the icon in an element that sets its colour with a token. Don't set a raw colour or a `fill` on it.
- Do give trend icons a `label`. Don't leave an informative icon without one.
- Do use `size="sm"` for inline indicators. Don't resize with CSS.
