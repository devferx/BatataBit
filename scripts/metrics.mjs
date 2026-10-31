// Mide el CSS del proyecto: colores hardcodeados fuera de :root, líneas totales
// y pares font-size/line-height distintos.
// Además cuenta referencias a tokens `var(--...)` y valores crudos que quedan fuera de tokens.css.
// Criterio oficial de pares: se excluye la regla raíz `html { font-size: 62.5% }` (baseline = 11).
// Si existe tokens.css se usa para resolver var() antes de comparar pares font-size/line-height.
// Acepta .css y .astro (de los .astro se miden solo los bloques <style>).
// Uso: node scripts/metrics.mjs [--out evidence/metrics/baseline.json] [--tokens src/styles/tokens.css]
//        [--components src/components] [--page src/pages/index.astro] [archivo.css|archivo.astro ...]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const tokIdx = args.indexOf("--tokens");
const tokensFile = tokIdx >= 0 ? args.splice(tokIdx, 2)[1] : "src/styles/tokens.css";
const compIdx = args.indexOf("--components");
const componentsDir = compIdx >= 0 ? args.splice(compIdx, 2)[1] : null;
const pageIdx = args.indexOf("--page");
const pageFile = pageIdx >= 0 ? args.splice(pageIdx, 2)[1] : null;
const componentFiles = componentsDir
  ? readdirSync(componentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `${componentsDir}/${d.name}/${d.name}.astro`)
      .filter(existsSync)
  : [];
const files = [...(args.length ? args : ["styles.css", "css/tablet.css"]), ...componentFiles];

// De un .astro solo cuentan los bloques <style>; de un .css, todo el archivo.
const cssOf = (file) => {
  const raw = readFileSync(file, "utf8");
  if (!file.endsWith(".astro")) return raw;
  return [...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
};
const lineCount = (text) => (text.trim() ? text.replace(/\n$/, "").split("\n").length : 0);
const cssLinesPerFile = {};

// Custom properties definidas en tokens.css, para resolver var(--x) -> valor.
const tokenDefs = new Map();
if (existsSync(tokensFile)) {
  // Solo el bloque :root base: el @media tablet reasigna esas mismas variables.
  for (const m of readFileSync(tokensFile, "utf8").split("@media")[0].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokenDefs.set(m[1], m[2].trim());
  }
}
const resolve = (value, depth = 0) =>
  depth > 10
    ? value
    : value.replace(/var\((--[\w-]+)\)/g, (whole, name) =>
        tokenDefs.has(name) ? resolve(tokenDefs.get(name), depth + 1) : whole,
      );

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Elimina bloques `:root { ... }` (las definiciones de custom properties).
const stripRoot = (css) => css.replace(/:root\s*\{[^}]*\}/g, "");

const colorRe =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;

// Extrae [selector, cuerpo] de reglas planas, incluyendo las de dentro de @media.
const rules = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

let totalLines = 0;
let tokenRefs = 0;
const rawValues = { colors: 0, typography: 0, radius: 0, shadow: 0, spacing: 0 };
const rawSpacing = new Set();
const colorLiterals = [];
const pairs = new Map();

for (const file of files) {
  const raw = cssOf(file);
  const n = lineCount(raw);
  cssLinesPerFile[file] = n;
  totalLines += n;
  const css = stripComments(raw);

  for (const m of stripRoot(css).matchAll(colorRe)) {
    colorLiterals.push({ file, value: m[0].toLowerCase() });
  }

  tokenRefs += [...stripRoot(css).matchAll(/var\(--[\w-]+\)/g)].length;

  for (const [selector, body] of rules(css)) {
    if (!selector.startsWith(":root")) {
      for (const d of body.split(";")) {
        const [prop, ...rest] = d.split(":");
        const val = rest.join(":").trim();
        const p = prop.trim();
        if (!val) continue;
        const fromToken = /^var\(--[\w-]+\)(\s*!important)?$/.test(val);
        if (/^(font-size|line-height|font-weight|font-family)$/.test(p) && !fromToken) rawValues.typography++;
        if (/^border-radius$/.test(p) && /\d+px/.test(val)) rawValues.radius++;
        if (/^box-shadow$/.test(p) && !fromToken) rawValues.shadow++;
        if (/^(margin|padding|gap|top|left|right|bottom)(-[a-z]+)?$/.test(p)) {
          for (const px of val.match(/-?\d+px/g) ?? []) {
            rawValues.spacing++;
            rawSpacing.add(px);
          }
        }
      }
    }
    // `html { font-size: 62.5% }` es la base de rem, no un estilo de texto.
    if (selector.startsWith(":root") || selector === "html") continue;
    const size = body.match(/font-size\s*:\s*([^;]+);?/)?.[1].trim();
    const lh = body.match(/line-height\s*:\s*([^;]+);?/)?.[1].trim();
    if (!size) continue;
    const key = `${resolve(size)}/${lh ? resolve(lh) : "unset"}`;
    pairs.set(key, [...(pairs.get(key) ?? []), selector]);
  }
}

rawValues.colors = colorLiterals.length;
const tokensCss = existsSync(tokensFile) ? readFileSync(tokensFile, "utf8") : "";

const result = {
  measuredAt: new Date().toISOString(),
  files,
  cssLines: totalLines,
  tokensCssLines: tokensCss ? tokensCss.replace(/\n$/, "").split("\n").length : 0,
  cssLinesPerFile: { ...cssLinesPerFile, ...(tokensCss ? { [tokensFile]: lineCount(tokensCss) } : {}) },
  components: componentFiles.length,
  ...(pageFile ? { pageLines: { [pageFile]: lineCount(readFileSync(pageFile, "utf8")) } } : {}),
  tokenReferences: tokenRefs,
  rawValuesOutsideTokens: {
    total: Object.values(rawValues).reduce((a, b) => a + b, 0),
    ...rawValues,
    distinctRawSpacing: [...rawSpacing].sort((a, b) => parseInt(a) - parseInt(b)),
  },
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
