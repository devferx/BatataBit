// Ejecuta el validador sobre archivos o carpetas (por defecto, todo el código del sitio). Sale con 1 si hay problemas.
// Uso: node mcp/src/validate-cli.ts [--json] [rutas...]   (con --json imprime los resultados y sale con 0)
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectRoot } from "./lib/root.ts";
import { validateFile } from "./lib/validate.ts";

const DEFAULTS = ["src/pages", "src/layouts", "src/components", "src/styles/global.css"];
const json = process.argv.includes("--json");
const argv = process.argv.slice(2).filter((a) => a !== "--json");
const targets = argv.length ? argv : DEFAULTS;

const collect = (p: string): string[] => {
  const abs = resolve(projectRoot, p);
  if (!statSync(abs).isDirectory()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? collect(join(p, e.name)) : /\.(astro|css)$/.test(e.name) ? [join(abs, e.name)] : []));
};

let total = 0;
const all = [];
for (const file of targets.flatMap(collect)) {
  const result = validateFile(file);
  all.push(result);
  total += result.issueCount;
  if (!result.ok && !json) {
    console.error(`${result.path}: ${result.issueCount} issue(s)`);
    for (const i of result.issues) console.error(`  ${i.line}:${i.column} [${i.rule}] ${i.message} Found: ${i.found}\n    -> ${i.suggestion}`);
  }
}
if (json) {
  console.log(JSON.stringify(all));
  process.exit(0);
}
if (total) {
  console.error(`ds:validate failed: ${total} issue(s)`);
  process.exit(1);
}
console.log("ds:validate OK: no raw values, no raw HTML where a component exists, no unknown tokens, no undocumented components");
