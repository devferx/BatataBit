// Contraste WCAG 2.x y búsqueda del color mínimo que pasa (misma matiz y saturación).
// Uso: node scripts/contrast/contrast.mjs   (imprime los valores de PHASE5-PROPOSAL.md §1)
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (h) => {
  const [r, g, b] = hex(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export const contrast = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const toHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
};
const fromHsl = ([h, s, l]) => {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
};

/** Color más cercano a `color` (misma matiz/saturación) que alcanza `min` contra todos los `bgs`. dir: -1 oscurece, 1 aclara. */
export const adjust = (color, bgs, min, dir) => {
  const [h, s, l0] = toHsl(hex(color));
  for (let l = l0; l >= 0 && l <= 1; l += dir * 0.001) {
    const c = fromHsl([h, s, l]);
    if (bgs.every((b) => contrast(c, b) >= min)) return c;
  }
  return null;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const OW = "#FAF8F7", W = "#FFFFFF";
  const row = (name, fg, bg) => console.log(name.padEnd(40), fg, "on", bg, contrast(fg, bg).toFixed(2));
  row("orange on off-white", "#F7931A", OW);
  row("blue on off-white", "#1A9AF7", OW);
  row("white on orange", W, "#F7931A");
  row("white on blue", W, "#1A9AF7");
  row("n900 on orange", "#201E1C", "#F7931A");
  row("n900 on blue", "#201E1C", "#1A9AF7");
  row("grey300 on white", "#BABABA", W);
  row("n600 on off-white", "#757575", OW);
  row("n500 on n800", "#808080", "#282623");
  row("n500 on n900", "#808080", "#201E1C");
  row("green on white", "#07D635", W);
  row("red on white", "#F5450D", W);
  const show = (n, c, bgs) => console.log(n.padEnd(40), c, bgs.map((b) => contrast(c, b).toFixed(2)).join(" / "));
  show("neutral/600 (4.8 on off-white)", adjust("#757575", [OW], 4.8, -1), [OW, W]);
  show("neutral/500 (4.8 on n800)", adjust("#808080", ["#282623"], 4.8, 1), ["#282623", "#201E1C"]);
  show("orange/700 text (4.8)", adjust("#F7931A", [OW, W], 4.8, -1), [OW, W]);
  show("blue/700 text (4.8)", adjust("#1A9AF7", [OW, W], 4.8, -1), [OW, W]);
  show("orange/600 border (3.2)", adjust("#F7931A", [OW, W], 3.2, -1), [OW, W]);
  show("green/600 (3.2 on white)", adjust("#07D635", [W], 3.2, -1), [W]);
}
