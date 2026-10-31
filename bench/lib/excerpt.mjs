// Extrae de una transcripción la sesión en la que el agente usa herramientas del sistema de diseño y corrige algo.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resultsDir } from "./common.mjs";

const clip = (s, n) => { const t = String(s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + " …" : t; };
const resultText = (c) => (typeof c.content === "string" ? c.content : (c.content ?? []).map((x) => x.text ?? "").join(" "));

export function loadEvents(id) {
  const file = join(resultsDir, "raw", id, "transcript.jsonl");
  if (!existsSync(file)) return [];
  const flat = [];
  for (const l of readFileSync(file, "utf8").split("\n")) {
    if (!l.trim()) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type === "assistant") for (const c of e.message?.content ?? []) {
      if (c.type === "text" && c.text.trim()) flat.push({ kind: "say", text: c.text });
      if (c.type === "tool_use") flat.push({ kind: "call", id: c.id, name: c.name, input: c.input });
    }
    if (e.type === "user") for (const c of e.message?.content ?? []) if (c.type === "tool_result") flat.push({ kind: "result", id: c.tool_use_id, text: resultText(c) });
  }
  return flat;
}

/** Cuántas llamadas a `batatabit-ds` hizo un run, por herramienta. */
export function mcpCalls(id) {
  const out = {};
  for (const e of loadEvents(id)) if (e.kind === "call" && e.name.startsWith("mcp__batatabit-ds__")) out[e.name.split("__").pop()] = (out[e.name.split("__").pop()] ?? 0) + 1;
  return out;
}

/** Texto markdown de la parte de la sesión que empieza en la primera llamada que cumple `isMatch` y llega hasta la corrección. */
export function sessionExcerpt(id, isMatch, title) {
  const ev = loadEvents(id);
  const i0 = ev.findIndex((e) => e.kind === "call" && isMatch(e));
  if (i0 < 0) return null;
  const hasIssues = (t) => /\[(raw-|unknown-|primitive-|missing-docs|raw-html)|issue\(s\)|"issueCount":\s*[1-9]|ds:validate failed/i.test(t);
  // primera corrección (Edit/Write) posterior a un resultado de validación con problemas
  let fixAt = -1;
  for (let i = i0; i < ev.length; i++) {
    if (ev[i].kind !== "result") continue;
    const call = ev.find((e) => e.kind === "call" && e.id === ev[i].id);
    if (call && isMatch(call) && hasIssues(ev[i].text)) { fixAt = ev.findIndex((e, j) => j > i && e.kind === "call" && /^(Edit|Write)$/.test(e.name)); break; }
  }
  const end = fixAt >= 0 ? Math.min(ev.length, fixAt + 6) : Math.min(ev.length, i0 + 14);
  const lines = [`# ${title}`, "", `Run \`${id}\`. Transcript lines condensed: long inputs and outputs are cut. ${fixAt >= 0 ? "The window runs from the first design-system call to the fix it prompted and the next check." : "No validation with problems was followed by a fix in this run; the window is the first calls."}`, ""];
  const names = new Map();
  for (let i = Math.max(0, i0 - 1); i < end; i++) {
    const e = ev[i];
    if (e.kind === "say") lines.push(`**Agent:** ${clip(e.text, 400)}`, "");
    if (e.kind === "call") { names.set(e.id, e.name); lines.push(`**Calls \`${e.name.replace("mcp__batatabit-ds__", "batatabit-ds › ")}\`** ${"`" + clip(JSON.stringify(e.input), 300) + "`"}`, ""); }
    if (e.kind === "result") lines.push("```", clip(e.text, 700), "```", "");
  }
  return lines.join("\n");
}
