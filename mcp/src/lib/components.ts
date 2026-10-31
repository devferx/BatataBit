// Lee las guías (src/components/<Name>/<Name>.md) y las interfaces Props (<Name>.astro) en tiempo de ejecución.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./root.ts";

export interface ComponentSummary {
  name: string;
  purpose: string;
  docPath: string;
  sourcePath: string;
}

export interface ParsedProp {
  name: string;
  type: string;
  /** `conditional` cuando la interfaz es una unión (p. ej. `href` solo es obligatorio con `as="a"`). */
  required: boolean | "conditional";
  default?: string;
  description: string;
}

const COMPONENTS_DIR = "src/components";

export function componentNames(): string[] {
  const dir = join(projectRoot, COMPONENTS_DIR);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, `${d.name}.astro`)))
    .map((d) => d.name)
    .sort();
}

const section = (md: string, title: string): string => {
  const m = md.match(new RegExp(`^## ${title.replace(/[/]/g, "\\/")}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
};

export function listComponents(): ComponentSummary[] {
  return componentNames().map((name) => {
    const docRel = `${COMPONENTS_DIR}/${name}/${name}.md`;
    const md = existsSync(join(projectRoot, docRel)) ? readFileSync(join(projectRoot, docRel), "utf8") : "";
    return {
      name,
      purpose: section(md, "Purpose").split("\n\n")[0] || "(no documentation yet)",
      docPath: docRel,
      sourcePath: `${COMPONENTS_DIR}/${name}/${name}.astro`,
    };
  });
}

// ---- parser de interfaces TypeScript (sin dependencia del compilador)

const stripFrontmatterComments = (code: string): string => code.replace(/^\s*\/\/.*$/gm, "");

interface Member { name: string; optional: boolean; type: string; doc: string }

function parseMembers(body: string): Member[] {
  const members: Member[] = [];
  let i = 0;
  let doc = "";
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body.startsWith("/**", i)) {
      const end = body.indexOf("*/", i);
      doc = body.slice(i + 3, end).split("\n").map((l) => l.replace(/^\s*\*\s?/, "")).join("\n").trim();
      i = end + 2;
      continue;
    }
    if (body.startsWith("//", i)) { i = body.indexOf("\n", i); if (i < 0) break; continue; }
    const m = body.slice(i).match(/^(?:readonly\s+)?(\w+)(\??)\s*:\s*/);
    if (!m) { i++; continue; }
    i += m[0].length;
    let depth = 0, type = "";
    for (; i < body.length; i++) {
      const c = body[i];
      if ("{[(<".includes(c)) depth++;
      else if ("}])>".includes(c) && !(c === ">" && body[i - 1] === "=")) depth--;
      if (c === ";" && depth === 0) { i++; break; }
      type += c;
    }
    members.push({ name: m[1], optional: m[2] === "?", type: type.replace(/\s+/g, " ").trim(), doc });
    doc = "";
  }
  return members;
}

function interfaceBodies(code: string): Map<string, { extends: string[]; members: Member[] }> {
  const out = new Map<string, { extends: string[]; members: Member[] }>();
  const re = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w\s,]+?))?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let depth = 1, i = re.lastIndex;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
    }
    out.set(m[1], { extends: (m[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean), members: parseMembers(code.slice(start, i - 1)) });
  }
  return out;
}

export function parseProps(name: string): ParsedProp[] {
  const src = readFileSync(join(projectRoot, COMPONENTS_DIR, name, `${name}.astro`), "utf8");
  const code = stripFrontmatterComments((src.match(/^---\n([\s\S]*?)\n---/) ?? ["", ""])[1]);
  const interfaces = interfaceBodies(code);
  const alias = code.match(/type\s+Props\s*=\s*([^;]+);/);
  const roots = alias ? alias[1].split("|").map((s) => s.trim()) : ["Props"];
  const collect = (iface: string, seen = new Set<string>()): Member[] => {
    const it = interfaces.get(iface);
    if (!it || seen.has(iface)) return [];
    seen.add(iface);
    return [...it.extends.flatMap((e) => collect(e, seen)), ...it.members];
  };
  const perRoot = roots.map((r) => collect(r));
  const names = [...new Set(perRoot.flat().map((m) => m.name))];
  return names.map((n) => {
    const occurrences = perRoot.map((members) => members.find((m) => m.name === n));
    const present = occurrences.filter((o): o is Member => !!o);
    const first = present[0];
    const flags = occurrences.map((o) => !!o && !o.optional);
    const required: ParsedProp["required"] = flags.every(Boolean) ? true : flags.some(Boolean) ? "conditional" : false;
    const doc = present.map((p) => p.doc).find(Boolean) ?? "";
    const def = present.map((p) => p.doc.match(/@default\s+(.+)/)?.[1]?.trim()).find(Boolean);
    return {
      name: n,
      type: [...new Set(present.map((p) => p.type))].join(" | "),
      required,
      default: def,
      description: doc.replace(/@default.*$/m, "").replace(/\s+/g, " ").trim(),
    };
  });
}

export interface ComponentDetail {
  name: string;
  docPath: string;
  sourcePath: string;
  props: ParsedProp[];
  tokensUsed: string[];
  doc: string;
}
export interface ComponentError {
  error: string;
  available: string[];
}

export function getComponent(name: string): ComponentDetail | ComponentError {
  const names = componentNames();
  const found = names.find((n) => n.toLowerCase() === name.toLowerCase());
  if (!found) return { error: `Unknown component "${name}".`, available: names };
  const docRel = `${COMPONENTS_DIR}/${found}/${found}.md`;
  const doc = existsSync(join(projectRoot, docRel)) ? readFileSync(join(projectRoot, docRel), "utf8") : "";
  const tokensUsed = [...section(doc, "Tokens used").matchAll(/`([a-z]+\.[A-Za-z0-9.-]+)`/g)].map((m) => m[1]);
  return { name: found, docPath: docRel, sourcePath: `${COMPONENTS_DIR}/${found}/${found}.astro`, props: parseProps(found), tokensUsed: [...new Set(tokensUsed)], doc };
}
