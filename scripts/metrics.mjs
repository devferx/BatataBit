// Mide el CSS del proyecto: colores hardcodeados fuera de :root, líneas totales
// y pares font-size/line-height distintos.
// Uso: node scripts/metrics.mjs [--out metrics/baseline.json] [archivo.css ...]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const files = args.length ? args : ["styles.css", "css/tablet.css"];

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Elimina bloques `:root { ... }` (las definiciones de custom properties).
const stripRoot = (css) => css.replace(/:root\s*\{[^}]*\}/g, "");

const colorRe =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;

// Extrae [selector, cuerpo] de reglas planas, incluyendo las de dentro de @media.
const rules = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

let totalLines = 0;
const colorLiterals = [];
const pairs = new Map();

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  totalLines += raw.replace(/\n$/, "").split("\n").length;
  const css = stripComments(raw);

  for (const m of stripRoot(css).matchAll(colorRe)) {
    colorLiterals.push({ file, value: m[0].toLowerCase() });
  }

  for (const [selector, body] of rules(css)) {
    // `html { font-size: 62.5% }` es la base de rem, no un estilo de texto.
    if (selector.startsWith(":root") || selector === "html") continue;
    const size = body.match(/font-size\s*:\s*([^;]+);?/)?.[1].trim();
    const lh = body.match(/line-height\s*:\s*([^;]+);?/)?.[1].trim();
    if (!size) continue;
    const key = `${size}/${lh ?? "unset"}`;
    pairs.set(key, [...(pairs.get(key) ?? []), selector]);
  }
}

const result = {
  measuredAt: new Date().toISOString(),
  files,
  cssLines: totalLines,
  hardcodedColorLiterals: {
    count: colorLiterals.length,
    distinct: [...new Set(colorLiterals.map((c) => c.value))].sort(),
  },
  fontSizeLineHeightPairs: {
    count: pairs.size,
    pairs: Object.fromEntries(pairs),
  },
};

const json = JSON.stringify(result, null, 2) + "\n";
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
}
console.log(json);
