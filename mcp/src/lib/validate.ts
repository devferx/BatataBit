// Validador estático del sistema de diseño: valores crudos fuera de tokens, HTML crudo donde existe un componente,
// tokens desconocidos o primitivos, y componentes nuevos sin documentación.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { componentNames } from "./components.ts";
import { getTokens, knownCssVars, loadTokens, parseColor, resolveValue, tokenForCssVar } from "./tokens.ts";
import { projectRoot } from "./root.ts";

export interface Issue {
  rule: string;
  severity: "error";
  line: number;
  column: number;
  message: string;
  found: string;
  suggestion: string;
}

export interface ValidationResult {
  path: string;
  ok: boolean;
  issueCount: number;
  issues: Issue[];
}

const DOC_SECTIONS = ["Purpose", "When to use", "When NOT to use", "Props", "Variants", "Tokens used", "Accessibility", "Examples", "Do / Don't"];

// Elementos HTML que ya tienen un componente en el catálogo.
const HTML_OWNERS: Record<string, string[]> = {
  button: ["Button"],
  table: ["CurrencyTable"],
  svg: ["Icon"],
  h1: ["SectionTitle"],
  h2: ["SectionTitle"],
  h3: ["FeatureCard", "PlanCard", "CurrencyTable"],
  article: ["FeatureCard", "PlanCard"],
};

const COLOR_PROPS = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|caret-color|text-decoration-color|box-shadow|text-shadow|accent-color|column-rule|column-rule-color)$/;
const SPACING_PROPS = /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const BORDER_WIDTH_PROPS = /^(border|border-(top|right|bottom|left)|border-width|border-(top|right|bottom|left)-width|outline|outline-width|column-rule|column-rule-width)$/;
const NAMED_COLORS = "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|coral|crimson|indigo|violet|beige|ivory|salmon|tan|khaki";
const DISALLOWED_PRIMITIVE_CATEGORIES = new Set(["color", "font", "radius", "shadow", "border"]);

const blankRange = (text: string, ranges: Array<[number, number]>): string => {
  const chars = [...text];
  for (const [a, b] of ranges) for (let i = a; i < b; i++) if (chars[i] !== "\n") chars[i] = " ";
  return chars.join("");
};
const blankComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));

const levenshtein = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

// ---- sugerencias --------------------------------------------------------------------------

const tokenLine = (t: { cssVar: string; path: string; description?: string }): string => `var(${t.cssVar}) (${t.path}${t.description ? `: ${t.description.split(". ")[0]}` : ""})`;

function colorSuggestion(literal: string): string {
  if (!parseColor(literal)) return "Use a semantic colour token: list them with get_tokens({ category: \"color\" }).";
  const r = resolveValue(literal);
  const semantic = r.exact.filter((t) => t.layer === "semantic");
  if (semantic.length) return `Exact match: ${semantic.slice(0, 3).map(tokenLine).join(" or ")}. Pick the one whose description fits the role.`;
  const n = r.nearest[0];
  return n
    ? `No exact token. Nearest: ${r.nearest.slice(0, 2).map((t) => `${tokenLine(t)} (ΔE ${t.distance})`).join("; ")}. ${r.note}`
    : "Use a semantic colour token.";
}

const pxOf = (literal: string): number => {
  const m = literal.match(/(-?\d*\.?\d+)(px|rem|em)/)!;
  return m[2] === "px" ? parseFloat(m[1]) : parseFloat(m[1]) * 10;
};

function nearestTokens(category: (path: string) => boolean, px: number, count = 1) {
  return loadTokens().tokens.filter((t) => t.layer === "primitive" && t.px !== undefined && category(t.path)).map((t) => ({ t, d: Math.abs((t.px as number) - px) })).sort((a, b) => a.d - b.d).slice(0, count);
}

function dimensionSuggestion(prop: string, literal: string): string {
  const px = pxOf(literal);
  if (SPACING_PROPS.test(prop)) {
    const [best] = nearestTokens((p) => p.startsWith("space."), Math.abs(px));
    const sign = px < 0 ? "calc(" + `var(${best.t.cssVar}) * -1)` : `var(${best.t.cssVar})`;
    return best.d === 0 ? `Use ${sign} (${best.t.path}).` : `Not on the 4px scale. Nearest: ${sign} (${best.t.path}, ${best.d}px away). Report the value if the design needs it exactly.`;
  }
  if (prop === "font-size") {
    const styles = loadTokens().tokens.filter((t) => t.type === "typography" && typeof t.resolved === "object" && !t.path.endsWith(".tablet"));
    const sized = styles.filter((t) => { const fs = (t.resolved as Record<string, string>).fontSize; return fs && pxOf(fs) === px; });
    if (sized.length) return `Use a text style with that size: ${sized.map((t) => t.path.replace(/\.mobile$/, "")).join(", ")} (set size, weight and line height together; see --${sized[0].cssVar.slice(2)}-size).`;
    const [best] = nearestTokens((p) => p.startsWith("font.size."), px);
    return `No text style has ${px}px. Nearest font size: ${best.t.path} (${best.d}px away); prefer a text.* style.`;
  }
  if (prop === "border-radius") {
    const sem = getTokens({ layer: "semantic", category: "radius" }).map((t) => ({ t, d: Math.abs(parseFloat(String(t.resolved)) - px) })).sort((a, b) => a.d - b.d);
    return `Use a semantic radius token: nearest ${tokenLine(sem[0].t)}${sem[0].d ? ` (${sem[0].d}px away)` : ""}.`;
  }
  if (BORDER_WIDTH_PROPS.test(prop)) {
    const sem = getTokens({ layer: "semantic", category: "border" }).map((t) => ({ t, d: Math.abs(parseFloat(String(t.resolved)) - px) })).sort((a, b) => a.d - b.d);
    return `Use ${tokenLine(sem[0].t)}${sem[0].d ? ` (nearest; ${sem[0].d}px away)` : ""}.`;
  }
  return "Use a token.";
}

const suggestions = {
  "line-height": "Use the line-height of a text.* style (for example var(--text-body-sm-line)); set size, weight and line height together.",
  "font-weight": "Use the weight of a text.* style (for example var(--text-button-weight)); do not set weights by hand.",
  "font-family": "Use var(--font-body) for headings and running text or var(--font-data) for data, numbers and small labels (or a text.* style's -family).",
  "letter-spacing": "Use the letter spacing of a text.* style (text.data-label and text.data-value set -2%).",
  "box-shadow": "Use var(--shadow-on-light) on light surfaces or var(--shadow-on-dark) on dark ones.",
} as const;

// ---- núcleo -------------------------------------------------------------------------------

export function validateFile(inputPath: string): ValidationResult {
  const abs = isAbsolute(inputPath) ? inputPath : resolve(projectRoot, inputPath);
  if (!existsSync(abs)) throw new Error(`File not found: ${inputPath}`);
  const real = realpathSync(abs);
  const rel = relative(realpathSync(projectRoot), real);
  if (rel.startsWith("..")) throw new Error("validate_file only reads files inside the project.");
  const text = readFileSync(real, "utf8");
  const isAstro = /\.(astro|html)$/.test(real);
  const isCss = real.endsWith(".css");

  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const at = (offset: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
  };
  const issues: Issue[] = [];
  const add = (rule: string, offset: number, message: string, found: string, suggestion: string) => {
    const { line, column } = at(offset);
    if (!issues.some((i) => i.rule === rule && i.line === line && i.column === column && i.message === message)) issues.push({ rule, severity: "error", line, column, message, found, suggestion });
  };

  // regiones
  const fm = isAstro ? text.match(/^---\n[\s\S]*?\n---/) : null;
  const fmRange: Array<[number, number]> = fm ? [[0, fm[0].length]] : [];
  const cssRegions: Array<[number, number]> = [];
  const scriptRanges: Array<[number, number]> = [];
  if (isCss) cssRegions.push([0, text.length]);
  if (isAstro) {
    for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      const start = m.index + m[0].indexOf(m[1], m[0].indexOf(">") + 1);
      cssRegions.push([start, start + m[1].length]);
      scriptRanges.push([m.index, m.index + m[0].length]);
    }
    for (const m of text.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)) scriptRanges.push([m.index, m.index + m[0].length]);
  }
  const template = isAstro ? blankComments(blankRange(text, [...fmRange, ...scriptRanges])) : "";

  // ---- declaraciones CSS (bloques <style>, archivos .css y atributos style="")
  const scanCss = (css: string, base: number) => {
    const clean = blankComments(css);
    for (const m of clean.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+)(?=;|\})/g)) {
      const prop = m[1].toLowerCase();
      const value = m[2];
      const valueOffset = base + m.index + m[0].indexOf(value);
      const noVars = value.replace(/var\([^)]*\)/g, " ").replace(/url\([^)]*\)/g, " ");
      if (prop.startsWith("--")) continue;

      if (COLOR_PROPS.test(prop)) {
        const lit = [...noVars.matchAll(new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\([^)]*\\)|\\b(?:${NAMED_COLORS})\\b`, "gi"))];
        for (const c of lit) add("raw-color", valueOffset + value.indexOf(c[0]), `Hardcoded colour in "${prop}".`, c[0], colorSuggestion(c[0]));
      }
      if (SPACING_PROPS.test(prop)) {
        for (const c of noVars.matchAll(/(?<![\w.-])-?\d*\.?\d+(px|rem|em)\b/g)) if (parseFloat(c[0]) !== 0) add("raw-spacing", valueOffset + value.indexOf(c[0]), `Raw spacing value in "${prop}".`, c[0], dimensionSuggestion(prop, c[0]));
      }
      if (prop === "font-size" && value.trim() !== "62.5%" && !/var\(/.test(value) && !/^(inherit|initial|unset)$/.test(value.trim())) {
        add("raw-font-size", valueOffset, "Raw font size.", value.trim(), /(px|rem|em)/.test(value) ? dimensionSuggestion(prop, value.trim()) : "Use the size of a text.* style.");
      }
      if (prop === "line-height" && !/var\(/.test(value) && !/^(inherit|initial|unset)$/.test(value.trim())) add("raw-line-height", valueOffset, "Raw line height.", value.trim(), suggestions["line-height"]);
      if (prop === "font-weight" && !/var\(/.test(value) && !/^(inherit|initial|unset)$/.test(value.trim())) add("raw-font-weight", valueOffset, "Raw font weight.", value.trim(), suggestions["font-weight"]);
      if (prop === "font-family" && !/var\(/.test(value) && !/^(inherit|initial|unset)$/.test(value.trim())) add("raw-font-family", valueOffset, "Raw font family.", value.trim(), suggestions["font-family"]);
      if (prop === "letter-spacing" && !/var\(/.test(value) && !/^(normal|0|inherit|initial|unset)$/.test(value.trim())) add("raw-letter-spacing", valueOffset, "Raw letter spacing.", value.trim(), suggestions["letter-spacing"]);
      if (prop === "border-radius") {
        for (const c of noVars.matchAll(/(?<![\w.-])-?\d*\.?\d+(px|rem|em)\b/g)) if (parseFloat(c[0]) !== 0) add("raw-radius", valueOffset + value.indexOf(c[0]), "Raw border radius.", c[0], dimensionSuggestion(prop, c[0]));
      }
      if (prop === "box-shadow" && value.trim() !== "none" && !/var\(/.test(value)) add("raw-shadow", valueOffset, "Raw box shadow.", value.trim(), suggestions["box-shadow"]);
      if (BORDER_WIDTH_PROPS.test(prop)) {
        for (const c of noVars.matchAll(/(?<![\w.-])\d*\.?\d+px\b/g)) if (parseFloat(c[0]) !== 0) add("raw-border-width", valueOffset + value.indexOf(c[0]), `Raw border width in "${prop}".`, c[0], dimensionSuggestion(prop, c[0]));
      }
    }
  };
  for (const [a, b] of cssRegions) scanCss(text.slice(a, b), a);
  if (isAstro) for (const m of template.matchAll(/\bstyle\s*=\s*"([^"]*)"/g)) scanCss(m[1] + ";", m.index + m[0].indexOf(m[1]));

  // ---- plantilla: atributos de color, clases con valores arbitrarios, HTML crudo
  if (isAstro) {
    for (const m of template.matchAll(/\b(fill|stroke|color|stop-color|bgcolor)\s*=\s*"([^"]*)"/g)) {
      const v = m[2].trim();
      if (!v || /^(none|currentcolor|transparent|inherit)$/i.test(v)) continue;
      if (parseColor(v) || new RegExp(`^(${NAMED_COLORS})$`, "i").test(v)) add("raw-color", m.index + m[0].indexOf(m[2]), `Hardcoded colour in the "${m[1]}" attribute.`, v, colorSuggestion(v));
    }
    for (const m of template.matchAll(/\bclass(?::list)?\s*=\s*(?:"([^"]*)"|\{([^}]*)\})/g)) {
      const body = m[1] ?? m[2];
      const offset = m.index + m[0].indexOf(body);
      for (const c of body.matchAll(/\[(?:#[0-9a-fA-F]{3,8}|-?\d*\.?\d+(?:px|rem|em))\]/g)) add("raw-class-value", offset + c.index, "Arbitrary raw value in a class name.", c[0], "Use a semantic token through the component props or a scoped style, not an arbitrary value.");
      if (/(^|\s)(btn|button)(\s|$)/.test(body) && /^<a\b/.test(template.slice(template.lastIndexOf("<", m.index), m.index + 2) + "")) {
        add("raw-html-component", template.lastIndexOf("<", m.index), 'Hand-made button link.', '<a class="btn">', "Use <Button variant=\"light\" as=\"a\" href=\"...\"> (see src/components/Button/Button.md).");
      }
    }
    const self = basename(real, ".astro");
    const insideOwnerFolder = rel.replace(/\\/g, "/").startsWith(`src/components/${self}/`);
    const available = new Set(componentNames());
    for (const m of template.matchAll(/<(button|table|svg|h1|h2|h3|article)\b/g)) {
      const owners = HTML_OWNERS[m[1]].filter((o) => available.has(o));
      if (!owners.length || (insideOwnerFolder && owners.includes(self))) continue;
      add("raw-html-component", m.index, `Raw <${m[1]}> where the catalog has ${owners.join(" / ")}.`, `<${m[1]}>`, `Use ${owners.map((o) => `<${o}>`).join(" or ")} (see src/components/${owners[0]}/${owners[0]}.md) instead of hand-made markup.`);
    }
  }

  // ---- tokens desconocidos y primitivos (en todo el archivo salvo comentarios)
  const known = knownCssVars();
  const noComments = blankComments(text);
  const local = new Set([...noComments.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of noComments.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = m[1];
    if (known.has(name) || local.has(name)) continue;
    const best = [...known].map((k) => ({ k, d: levenshtein(name, k) })).sort((a, b) => a.d - b.d)[0];
    add("unknown-token", m.index + m[0].indexOf(name), `"${name}" is not defined in tokens.css.`, name, `Did you mean var(${best.k})? List real tokens with get_tokens.`);
  }
  for (const m of noComments.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = m[1];
    if (!known.has(name)) continue;
    const t = tokenForCssVar(name);
    if (!t || t.layer !== "primitive" || !DISALLOWED_PRIMITIVE_CATEGORIES.has(t.category)) continue;
    const aliases = loadTokens().tokens.filter((x) => x.aliasOf === t.path);
    add("primitive-token", m.index + m[0].indexOf(name), `"${name}" is a primitive token; components consume semantic tokens only.`, name, aliases.length ? `Use ${aliases.slice(0, 3).map(tokenLine).join(" or ")}.` : typeof t.resolved === "string" ? colorSuggestion(t.resolved) : "Use the semantic token for this role.");
  }

  // ---- componentes nuevos sin documentación
  const compMatch = rel.replace(/\\/g, "/").match(/^src\/components\/(\w+)\/\1\.astro$/);
  if (compMatch) {
    const name = compMatch[1];
    const docRel = `src/components/${name}/${name}.md`;
    if (!existsSync(join(projectRoot, docRel))) {
      add("missing-docs", 0, `Component ${name} has no guide.`, `${name}.astro`, `Create ${docRel} with the nine sections (Purpose, When to use, When NOT to use, Props, Variants, Tokens used, Accessibility, Examples, Do / Don't) and run npm run docs:check.`);
    } else {
      const md = readFileSync(join(projectRoot, docRel), "utf8");
      const missing = DOC_SECTIONS.filter((s) => !new RegExp(`^## ${s.replace("/", "\\/")}\\s*$`, "m").test(md));
      if (missing.length) add("missing-docs", 0, `${docRel} lacks sections: ${missing.join(", ")}.`, docRel, "Add the missing sections and run npm run docs:check.");
    }
    const index = existsSync(join(projectRoot, "docs/components.md")) ? readFileSync(join(projectRoot, "docs/components.md"), "utf8") : "";
    if (!index.includes(`| ${name} |`)) add("missing-docs", 0, `${name} is not listed in docs/components.md.`, name, "Add a one-line entry (name, purpose, path to the guide) to docs/components.md.");
  }

  issues.sort((a, b) => a.line - b.line || a.column - b.column);
  return { path: rel.replace(/\\/g, "/"), ok: issues.length === 0, issueCount: issues.length, issues };
}
