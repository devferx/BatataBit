// Lee src/tokens/tokens.json en tiempo de ejecución (única fuente de verdad) y responde consultas sobre ella.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./root.ts";

export type Layer = "primitive" | "semantic";

export interface Token {
  path: string;
  layer: Layer;
  category: string;
  type: string;
  /** Nombre de la custom property CSS (para tipografía, el prefijo: `--text-lead` + `-size`, `-line`...). */
  cssVar: string;
  /** Valor final, con los alias resueltos, en forma de texto o de objeto (tipografía). */
  resolved: string | Record<string, string>;
  description?: string;
  /** Ruta del token al que apunta, si es un alias. */
  aliasOf?: string;
  /** Valor en px para dimensiones (rem se convierte con la raíz del 62.5%). */
  px?: number;
}

interface RawToken {
  $value: unknown;
  $type: string;
  $description?: string;
  $extensions?: Record<string, string>;
}

let cache: { tokens: Token[]; byPath: Map<string, Token> } | null = null;

const isToken = (v: unknown): v is RawToken => typeof v === "object" && v !== null && "$value" in v;

const hasAlias = (v: unknown): boolean =>
  typeof v === "string" ? /\{[^}]+\}/.test(v) : typeof v === "object" && v !== null ? Object.values(v).some(hasAlias) : false;

export function loadTokens(): { tokens: Token[]; byPath: Map<string, Token> } {
  if (cache) return cache;
  const tree = JSON.parse(readFileSync(join(projectRoot, "src/tokens/tokens.json"), "utf8"));
  const raw = new Map<string, { token: RawToken; groupDescription?: string }>();
  const walk = (node: Record<string, unknown>, path: string[], groupDescription?: string) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("$") || typeof value !== "object" || value === null) continue;
      if (isToken(value)) raw.set([...path, key].join("."), { token: value, groupDescription });
      else walk(value as Record<string, unknown>, [...path, key], (value as { $description?: string }).$description ?? groupDescription);
    }
  };
  walk(tree, [], undefined);

  const refPath = (s: string) => s.replace(/^\{|\}$/g, "");
  const resolveScalar = (value: unknown): unknown => {
    if (typeof value === "string" && /^\{[^}]+\}$/.test(value)) {
      const target = raw.get(refPath(value));
      if (!target) throw new Error(`Alias sin destino: ${value}`);
      return resolveToken(target.token);
    }
    return value;
  };
  const resolveToken = (t: RawToken): unknown => {
    const v = t.$value;
    if (Array.isArray(v) && t.$type === "gradient") {
      const angle = t.$extensions?.["batatabit.angle"] ?? "180deg";
      const stops = v.map((s: { color: string; position: number; opacity?: number }) => {
        const c = String(resolveScalar(s.color));
        const col = s.opacity === undefined ? c : `color-mix(in srgb, ${c} ${+(s.opacity * 100).toFixed(2)}%, transparent)`;
        return `${col} ${+(s.position * 100).toFixed(2)}%`;
      });
      return `linear-gradient(${angle}, ${stops.join(", ")})`;
    }
    if (t.$type === "typography" && typeof v === "object" && v !== null) {
      const o: Record<string, string> = {};
      for (const [k, x] of Object.entries(v)) o[k] = fmt(resolveScalar(x));
      return o;
    }
    if (t.$type === "shadow" && typeof v === "object" && v !== null && !Array.isArray(v)) {
      const s = v as Record<string, string>;
      return `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
    }
    return resolveScalar(v);
  };
  const fmt = (x: unknown): string => (Array.isArray(x) ? x.map((f) => (/\s/.test(String(f)) ? `"${f}"` : String(f))).join(", ") : String(x));

  const tokens: Token[] = [];
  for (const [path, { token, groupDescription }] of raw) {
    const resolvedRaw = resolveToken(token);
    const resolved = typeof resolvedRaw === "object" && resolvedRaw !== null && !Array.isArray(resolvedRaw) ? (resolvedRaw as Record<string, string>) : fmt(resolvedRaw);
    const semantic = hasAlias(token.$value);
    const name = path.split(".").filter((s) => s !== "mobile").join("-");
    const t: Token = {
      path,
      layer: semantic ? "semantic" : "primitive",
      category: path.split(".")[0],
      type: token.$type,
      cssVar: `--${name}`,
      resolved: token.$type === "color" && typeof resolved === "string" ? resolved.toUpperCase() : resolved,
      description: token.$description ?? groupDescription,
    };
    if (typeof token.$value === "string" && /^\{[^}]+\}$/.test(token.$value)) t.aliasOf = refPath(token.$value);
    if (token.$type === "dimension" && typeof resolved === "string") {
      const m = resolved.match(/^(-?\d*\.?\d+)(px|rem)$/);
      if (m) t.px = m[2] === "rem" ? +(parseFloat(m[1]) * 10).toFixed(2) : parseFloat(m[1]);
    }
    tokens.push(t);
  }
  cache = { tokens, byPath: new Map(tokens.map((t) => [t.path, t])) };
  return cache;
}

export interface TokenFilter {
  layer?: "semantic" | "primitive" | "all";
  category?: string;
  search?: string;
}

export function getTokens(filter: TokenFilter = {}): Token[] {
  const { tokens } = loadTokens();
  const layer = filter.layer ?? "semantic";
  const q = filter.search?.toLowerCase();
  return tokens.filter(
    (t) =>
      (layer === "all" || t.layer === layer) &&
      (!filter.category || t.category === filter.category) &&
      (!q || t.path.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)),
  );
}

export const categories = (): string[] => [...new Set(loadTokens().tokens.map((t) => t.category))];

/** Custom properties definidas en tokens.css (para detectar `var(--x)` desconocidas). */
export function knownCssVars(): Set<string> {
  const css = readFileSync(join(projectRoot, "src/styles/tokens.css"), "utf8");
  return new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
}

/** Token al que corresponde un `var(--x)`: acepta los sufijos de tipografía. */
export function tokenForCssVar(name: string): Token | undefined {
  const { tokens } = loadTokens();
  const exact = tokens.find((t) => t.cssVar === name && typeof t.resolved === "string");
  if (exact) return exact;
  return tokens
    .filter((t) => t.type === "typography" && name.startsWith(t.cssVar + "-") && /^(family|size|weight|line|letter-spacing)$/.test(name.slice(t.cssVar.length + 1)))
    .sort((a, b) => b.cssVar.length - a.cssVar.length)[0];
}

// ---------------------------------------------------------------------------------------------
// Color y resolución de valores crudos
// ---------------------------------------------------------------------------------------------

export function parseColor(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

const toLab = ({ r, g, b }: { r: number; g: number; b: number }): [number, number, number] => {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
export const deltaE = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number => {
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
};

type Brief = Pick<Token, "path" | "layer" | "resolved" | "description" | "cssVar">;
const brief = (t: Token): Brief => ({ path: t.path, layer: t.layer, resolved: t.resolved, description: t.description, cssVar: t.cssVar });

export interface Resolution {
  input: string;
  kind: "color" | "dimension" | "font-weight" | "font-family" | "unknown";
  normalized?: string;
  exact: Brief[];
  nearest: Array<Brief & { distance: number; unit: string }>;
  note: string;
}

const DIM_CATEGORIES: Array<{ label: string; test: (t: Token) => boolean; hint: string }> = [
  { label: "spacing (margin, padding, gap)", test: (t) => t.category === "space", hint: "Spacing has no semantic layer: use space.* tokens directly." },
  { label: "font size", test: (t) => t.path.startsWith("font.size."), hint: "Prefer a text.* style, which also sets weight and line height." },
  { label: "line height", test: (t) => t.path.startsWith("font.line-height."), hint: "Prefer a text.* style." },
  { label: "radius", test: (t) => t.category === "radius", hint: "Use the semantic radius token (radius.button, radius.card, radius.card-compact, radius.chip)." },
  { label: "border width", test: (t) => t.category === "border", hint: "Use border.divider or border.button." },
  { label: "layout / focus", test: (t) => t.category === "layout" || t.category === "focus", hint: "Layout tokens hold page-level values." },
];

export function resolveValue(input: string): Resolution {
  const raw = input.trim();
  const { tokens } = loadTokens();

  const color = parseColor(raw);
  if (color) {
    const colors = tokens.filter((t) => t.type === "color" && typeof t.resolved === "string");
    const hex = (t: Token) => parseColor(String(t.resolved))!;
    const normalized = "#" + [color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    const exact = colors.filter((t) => String(t.resolved) === normalized);
    const semanticFirst = [...exact].sort((a, b) => Number(b.layer === "semantic") - Number(a.layer === "semantic"));
    const nearest = colors
      .filter((t) => t.layer === "semantic")
      .map((t) => ({ t, d: deltaE(color, hex(t)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map(({ t, d }) => ({ ...brief(t), distance: +d.toFixed(2), unit: "ΔE" }));
    const note = exact.length
      ? "Exact match. Pick the semantic token whose description matches the role; several tokens can share a value."
      : nearest[0] && nearest[0].distance <= 6
        ? "No exact match; the nearest semantic token is visually close (ΔE ≤ 6). Treat the raw value as drift and use it."
        : "No close semantic colour. Do not add a raw value: check the Figma style or variable, or add a token with a description.";
    return { input, kind: "color", normalized, exact: semanticFirst.map(brief), nearest, note };
  }

  const w = raw.toLowerCase();
  if (/^(100|200|300|400|500|600|700|800|900|normal|bold|medium|regular)$/.test(w)) {
    const n = { normal: 400, regular: 400, medium: 500, bold: 700 }[w as "normal"] ?? Number(w);
    const weights = tokens.filter((t) => t.path.startsWith("font.weight."));
    const exact = weights.filter((t) => Number(t.resolved) === n);
    const nearest = weights.map((t) => ({ ...brief(t), distance: Math.abs(Number(t.resolved) - n), unit: "weight" })).sort((a, b) => a.distance - b.distance).slice(0, 2);
    return { input, kind: "font-weight", normalized: String(n), exact: exact.map(brief), nearest, note: "Weights come from the text.* styles; do not set font-weight by hand." };
  }
  if (/dm sans|inter/.test(w)) {
    const fam = tokens.filter((t) => t.type === "fontFamily" && String(t.resolved).toLowerCase().includes(/dm sans/.test(w) ? "dm sans" : "inter"));
    return { input, kind: "font-family", exact: fam.map(brief), nearest: [], note: "Inter is for data, numbers and small labels; DM Sans for headings and running text." };
  }

  const dim = raw.match(/^(-?\d*\.?\d+)\s*(px|rem)?$/i);
  if (dim) {
    const n = parseFloat(dim[1]);
    const px = (dim[2] ?? "px").toLowerCase() === "rem" ? +(n * 10).toFixed(2) : n;
    const dims = tokens.filter((t) => t.px !== undefined);
    const exact = dims.filter((t) => t.px === px).sort((a, b) => Number(b.layer === "semantic") - Number(a.layer === "semantic"));
    const nearest: Resolution["nearest"] = [];
    for (const cat of DIM_CATEGORIES) {
      const inCat = dims.filter((t) => cat.test(t) && t.layer === "primitive");
      const best = inCat.map((t) => ({ t, d: Math.abs((t.px as number) - px) })).sort((a, b) => a.d - b.d).slice(0, 2);
      for (const { t, d } of best) nearest.push({ ...brief(t), description: `[${cat.label}] ${cat.hint}`, distance: +d.toFixed(2), unit: "px" });
    }
    const spacingExact = exact.some((t) => t.category === "space");
    const nearestSpace = nearest.find((n) => n.path.startsWith("space."));
    const parts: string[] = [];
    if (exact.length) parts.push(`Exact matches by role are listed (${[...new Set(exact.map((t) => DIM_CATEGORIES.find((c) => c.test(t))?.label ?? t.category))].join("; ")}); choose by what the value is for.`);
    if (!spacingExact) parts.push(`No spacing token has this value: it is not on the 4px scale. Report it instead of adding a raw value, or use the nearest spacing token${nearestSpace ? ` (${nearestSpace.path}, ${nearestSpace.distance}px away)` : ""}.`);
    return { input, kind: "dimension", normalized: `${px}px`, exact: exact.map(brief), nearest, note: parts.join(" ") };
  }

  return { input, kind: "unknown", exact: [], nearest: [], note: "Unrecognised value. Pass a hex colour, an rgb() colour, a size in px or rem, a font weight or a font family." };
}
