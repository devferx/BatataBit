// Comprueba que la documentación no se desvíe del código:
//  1. cada componente tiene su guía <Name>.md con las secciones obligatorias;
//  2. los props de la interfaz Props del componente coinciden con la tabla "Props" de su guía (en ambos sentidos);
//  3. todo token citado entre comillas invertidas en los docs existe en src/tokens/tokens.json;
//  4. docs/components.md lista cada componente con la ruta de su guía;
//  5. los docs no contienen notas de proceso ni referencias a secciones reservadas.
// Uso: node scripts/check-docs.mjs   (o npm run docs:check)
import { readFileSync, readdirSync, existsSync } from "node:fs";

const COMPONENTS_DIR = "src/components";
const DOCS = ["docs/design-system.md", "docs/components.md"];
const SECTIONS = ["Purpose", "When to use", "When NOT to use", "Props", "Variants", "Tokens used", "Accessibility", "Examples", "Do / Don't"];
const errors = [];
const fail = (msg) => errors.push(msg);

// ---- tokens: todas las rutas (tokens y grupos)
const tokenPaths = new Set();
const walk = (node, path) => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$") || typeof value !== "object" || value === null) continue;
    const p = [...path, key];
    tokenPaths.add(p.join("."));
    if (!("$value" in value)) walk(value, p);
  }
};
walk(JSON.parse(readFileSync("src/tokens/tokens.json", "utf8")), []);

// ---- props de la interfaz Props de un .astro
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const parseInterfaces = (code) => {
  const found = new Map();
  const re = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w\s,]+?))?\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    let depth = 1, i = re.lastIndex, top = "";
    for (; i < code.length && depth > 0; i++) {
      const c = code[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 1) top += c;
    }
    const props = new Set();
    for (const p of top.matchAll(/(?:^|[;\n,])\s*(?:readonly\s+)?(\w+)\??\s*:/g)) props.add(p[1]);
    found.set(m[1], { extends: (m[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean), props });
  }
  return found;
};

const propsOf = (file) => {
  const src = readFileSync(file, "utf8");
  const code = stripComments((src.match(/^---\n([\s\S]*?)\n---/) ?? [, ""])[1]);
  const interfaces = parseInterfaces(code);
  const alias = code.match(/type\s+Props\s*=\s*([^;]+);/);
  const roots = alias ? alias[1].split("|").map((s) => s.trim()) : ["Props"];
  const result = new Set();
  const collect = (name) => {
    const it = interfaces.get(name);
    if (!it) return;
    it.props.forEach((p) => result.add(p));
    it.extends.forEach(collect);
  };
  roots.forEach(collect);
  return result;
};

// ---- primera tabla de la sección "## Props" de una guía
const docProps = (text) => {
  const start = text.search(/^## Props\s*$/m);
  if (start < 0) return null;
  const rest = text.slice(start).split("\n").slice(1);
  const body = [];
  for (const line of rest) {
    if (/^#{1,6}\s/.test(line)) break;
    body.push(line);
  }
  const rows = [];
  let inTable = false;
  for (const line of body) {
    if (line.startsWith("|")) { inTable = true; rows.push(line); } else if (inTable) break;
  }
  const names = new Set();
  for (const row of rows.slice(2)) {
    const first = row.replace(/\\\|/g, "\u0000").split("|")[1] ?? "";
    names.add(first.replace(/\u0000/g, "|").replace(/`/g, "").trim());
  }
  return names;
};

const components = readdirSync(COMPONENTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const docTexts = {};

for (const name of components) {
  const astro = `${COMPONENTS_DIR}/${name}/${name}.astro`;
  const doc = `${COMPONENTS_DIR}/${name}/${name}.md`;
  if (!existsSync(astro)) { fail(`${name}: falta ${astro}`); continue; }
  if (!existsSync(doc)) { fail(`${name}: falta la guía ${doc}`); continue; }
  const text = readFileSync(doc, "utf8");
  docTexts[doc] = text;

  const headings = [...text.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
  const missing = SECTIONS.filter((s) => !headings.includes(s));
  if (missing.length) fail(`${doc}: faltan secciones: ${missing.join(", ")}`);
  else if (SECTIONS.join("|") !== headings.filter((h) => SECTIONS.includes(h)).join("|")) fail(`${doc}: las secciones no están en el orden requerido`);

  const code = propsOf(astro);
  const documented = docProps(text);
  if (!documented) { fail(`${doc}: no hay tabla en "## Props"`); continue; }
  for (const p of code) if (!documented.has(p)) fail(`${doc}: el prop "${p}" existe en ${astro} pero no está en la tabla Props`);
  for (const p of documented) if (!code.has(p)) fail(`${doc}: la tabla Props documenta "${p}", que no existe en ${astro}`);
}

for (const doc of DOCS) {
  if (!existsSync(doc)) fail(`falta ${doc}`);
  else docTexts[doc] = readFileSync(doc, "utf8");
}

// ---- docs/components.md lista todos los componentes con su guía
const index = docTexts["docs/components.md"] ?? "";
for (const name of components) {
  const path = `src/components/${name}/${name}.md`;
  if (!index.includes(`(../${path})`) || !index.includes(`| ${name} |`)) fail(`docs/components.md: falta la línea de ${name} con la ruta ${path}`);
}

// ---- tokens citados y texto prohibido
const TOKEN_RE = /`((?:color|font|radius|space|shadow|gradient|border|layout|text|breakpoint)\.[A-Za-z0-9.-]*[A-Za-z0-9])`/g;
for (const [doc, text] of Object.entries(docTexts)) {
  const prose = text.replace(/```[\s\S]*?```/g, "");
  for (const m of prose.matchAll(TOKEN_RE)) if (!tokenPaths.has(m[1])) fail(`${doc}: el token "${m[1]}" no existe en tokens.json`);
  for (const bad of [/\bTODO\b/, /\bFIXME\b/, /\bPhase \d/i, /\bFase \d/i, /\bFAQ\b/i]) if (bad.test(text)) fail(`${doc}: contiene texto no permitido (${bad})`);
}

if (errors.length) {
  console.error(`docs:check FALLÓ (${errors.length})`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`docs:check OK: ${components.length} componentes, ${Object.keys(docTexts).length} documentos, ${tokenPaths.size} rutas de token`);
