// Genera src/styles/tokens.css a partir de src/tokens/tokens.json (formato W3C DTCG).
// Capas: primitivos (valores crudos) primero, semánticos (alias con $description) después.
// Un token es semántico si su valor contiene un alias `{ruta.del.token}`.
// Nombres CSS: ruta unida con "-" (color.orange.500 -> --color-orange-500).
// Tipografía: el segmento `mobile` se omite (text.lead.mobile -> --text-lead-size);
// `tablet` se conserva en la ruta (text.lead.tablet -> --text-lead-tablet-size).
// Los pares `mobile`/`tablet` (tipografía y dimensiones) generan además un bloque
// `@media (min-width: <breakpoint.tablet>)` que reasigna las variables base a los valores tablet.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "src/tokens/tokens.json";
const OUT = "src/styles/tokens.css";

const tree = JSON.parse(readFileSync(SRC, "utf8"));
const tokens = []; // { path, token }

const walk = (node, path, groupDescription) => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (value && typeof value === "object" && "$value" in value) {
      tokens.push({ path: [...path, key], token: value, groupDescription });
    } else if (value && typeof value === "object") {
      walk(value, [...path, key], value.$description ?? groupDescription);
    }
  }
};
walk(tree, [], undefined);

const byPath = new Map(tokens.map((t) => [t.path.join("."), t]));
const cssName = (path) =>
  "--" + path.filter((s) => s !== "mobile").join("-");

const hasAlias = (v) =>
  typeof v === "string"
    ? /\{[^}]+\}/.test(v)
    : v && typeof v === "object"
      ? Object.values(v).some(hasAlias)
      : false;

const errors = [];
const ref = (v) =>
  String(v).replace(/\{([^}]+)\}/g, (_, p) => {
    if (!byPath.has(p)) {
      errors.push(`Alias sin destino: {${p}}`);
      return p;
    }
    return `var(${cssName(byPath.get(p).path)})`;
  });

const num = (n) => Number((n * 100).toFixed(4));

const declarations = ({ path, token }) => {
  const name = cssName(path);
  const v = token.$value;
  switch (token.$type) {
    case "fontFamily":
      if (Array.isArray(v)) {
        return [[name, v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ")]];
      }
      return [[name, ref(v)]];
    case "shadow":
      if (typeof v === "string") return [[name, ref(v)]];
      return [[name, `${v.offsetX} ${v.offsetY} ${v.blur} ${v.spread} ${v.color}`]];
    case "gradient": {
      const angle = token.$extensions?.["batatabit.angle"] ?? "180deg";
      const stops = v.map((s) => `${ref(s.color)} ${num(s.position)}%`).join(", ");
      return [[name, `linear-gradient(${angle}, ${stops})`]];
    }
    case "typography":
      return [
        [`${name}-family`, ref(v.fontFamily)],
        [`${name}-size`, ref(v.fontSize)],
        [`${name}-weight`, ref(v.fontWeight)],
        [`${name}-line`, ref(v.lineHeight)],
        ...(v.letterSpacing ? [[`${name}-letter-spacing`, ref(v.letterSpacing)]] : []),
      ];
    default:
      return [[name, ref(v)]];
  }
};

const primitives = tokens.filter((t) => !hasAlias(t.token.$value));
const semantic = tokens.filter((t) => hasAlias(t.token.$value));

for (const t of semantic) {
  if (!(t.token.$description ?? t.groupDescription)) errors.push(`Falta $description: ${t.path.join(".")}`);
}
const breakpoint = byPath.get("breakpoint.tablet")?.token.$value;
if (!breakpoint) errors.push("Falta el token breakpoint.tablet");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const block = (title, list, withDescription) => {
  const lines = [`  /* ${title} */`];
  for (const t of list) {
    if (withDescription) lines.push(`  /* ${(t.token.$description ?? t.groupDescription).replace(/\*\//g, "* /")} */`);
    for (const [k, val] of declarations(t)) lines.push(`  ${k}: ${val};`);
  }
  return lines.join("\n");
};

// Pares mobile/tablet: a partir del breakpoint las variables base toman el valor tablet.
const tabletReassign = [];
for (const t of tokens) {
  if (t.path.at(-1) !== "tablet") continue;
  const mobilePath = [...t.path.slice(0, -1), "mobile"];
  const mobile = byPath.get(mobilePath.join("."));
  if (!mobile) continue;
  const base = declarations(mobile);
  const tablet = declarations(t);
  base.forEach(([name], i) => {
    if (t.token.$type === "typography" && /-(family|weight|letter-spacing)$/.test(name)) return;
    tabletReassign.push(`    ${name}: var(${tablet[i][0]});`);
  });
}

const css = `/* GENERADO por scripts/build-tokens.mjs desde src/tokens/tokens.json. No editar a mano. */
:root {
${block("Primitivos", primitives, false)}

${block("Semánticos", semantic, true)}
}

@media (min-width: ${breakpoint}) {
  :root {
${tabletReassign.join("\n")}
  }
}
`;
writeFileSync(OUT, css);
console.log(`${OUT}: ${primitives.length} primitivos, ${semantic.length} semánticos`);
