// Pruebas de integración: arrancan el servidor real por stdio y llaman a cada herramienta con el cliente oficial.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const serverPath = join(root, "mcp/src/index.ts");

async function connect(projectRoot: string) {
  const client = new Client({ name: "ds-test", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], cwd: projectRoot, env: { ...process.env, BATATABIT_ROOT: projectRoot } as Record<string, string> });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: Array<{ type: string; text: string }> };
    return { isError: !!res.isError, data: JSON.parse(res.content[0].text) as any };
  };
  return { client, call };
}

describe("batatabit-ds MCP server", () => {
  let client: Client;
  let call: Awaited<ReturnType<typeof connect>>["call"];
  before(async () => ({ client, call } = await connect(root)));
  after(async () => { await client.close(); });

  test("exposes the five tools with descriptions", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["get_component", "get_tokens", "list_components", "resolve_value", "validate_file"]);
    for (const t of tools) assert.ok(t.description && t.description.length > 40, `${t.name} needs a description`);
  });

  test("list_components: every component with purpose and an existing guide", async () => {
    const { data } = await call("list_components");
    const dirs = readdirSync(join(root, "src/components"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    assert.deepEqual(data.map((c: any) => c.name), dirs);
    for (const c of data) {
      assert.ok(c.purpose.length > 15 && !c.purpose.includes("no documentation"), `${c.name} purpose`);
      assert.ok(existsSync(join(root, c.docPath)), `${c.docPath} exists`);
    }
  });

  test("get_component: Button props are parsed from the Props interface", async () => {
    const { data, isError } = await call("get_component", { name: "button" });
    assert.equal(isError, false);
    assert.equal(data.name, "Button");
    assert.match(data.doc, /## When NOT to use/);
    const byName = Object.fromEntries(data.props.map((p: any) => [p.name, p]));
    assert.deepEqual(Object.keys(byName).sort(), ["as", "ariaLabel", "href", "icon", "variant"].sort());
    assert.equal(byName.variant.required, true);
    assert.equal(byName.variant.type, '"light" | "outline"');
    assert.equal(byName.href.required, "conditional");
    assert.equal(byName.as.default, '"button"');
    assert.ok(data.tokensUsed.includes("color.focus-ring"));
  });

  test("get_component: parsed props match the Props table of every guide", async () => {
    const { data: all } = await call("list_components");
    for (const c of all) {
      const { data } = await call("get_component", { name: c.name });
      const md = readFileSync(join(root, c.docPath), "utf8");
      const table = md.split(/^## Props\s*$/m)[1].split(/^#{1,6} /m)[0].split("\n").filter((l) => l.startsWith("|")).slice(2);
      const documented = table.map((l) => l.replace(/\\\|/g, "").split("|")[1].replace(/`/g, "").trim()).sort();
      assert.deepEqual(data.props.map((p: any) => p.name).sort(), documented, c.name);
      for (const p of data.props) assert.ok(p.description.length > 5, `${c.name}.${p.name} has a description`);
    }
  });

  test("get_component: nested object props and defaults", async () => {
    const { data } = await call("get_component", { name: "PlanCard" });
    const badge = data.props.find((p: any) => p.name === "badge");
    assert.equal(badge.required, false);
    assert.match(badge.type, /label: string/);
    const { data: badgeDoc } = await call("get_component", { name: "Badge" });
    assert.equal(badgeDoc.props.find((p: any) => p.name === "size").default, '"md"');
  });

  test("get_component: unknown name returns an error with the available components", async () => {
    const { data, isError } = await call("get_component", { name: "Carousel" });
    assert.equal(isError, true);
    assert.ok(data.available.includes("Button"));
  });

  test("get_tokens: semantic by default, with descriptions", async () => {
    const { data } = await call("get_tokens");
    assert.ok(data.every((t: any) => t.layer === "semantic" && t.description));
    const primary = data.find((t: any) => t.path === "color.primary");
    assert.equal(primary.resolved, "#F7931A");
    assert.equal(primary.cssVar, "--color-primary");
    assert.ok(!data.some((t: any) => t.path === "color.orange.500"));
  });

  test("get_tokens: layers, categories and search", async () => {
    const prim = (await call("get_tokens", { layer: "primitive", category: "color" })).data;
    assert.ok(prim.some((t: any) => t.path === "color.orange.500") && prim.every((t: any) => t.category === "color" && t.layer === "primitive"));
    const focus = (await call("get_tokens", { search: "focus" })).data.map((t: any) => t.path);
    assert.ok(focus.includes("color.focus-ring") && focus.includes("focus.ring-width"));
    const text = (await call("get_tokens", { category: "text" })).data.find((t: any) => t.path === "text.button");
    assert.equal(text.resolved.fontSize, "1.4rem");
    const all = (await call("get_tokens", { layer: "all" })).data;
    assert.ok(all.some((t: any) => t.layer === "primitive") && all.some((t: any) => t.layer === "semantic"));
  });

  test("resolve_value: exact colours return every semantic role that shares the value", async () => {
    for (const input of ["#FAF8F7", "#faf8f7", "rgb(250, 248, 247)"]) {
      const { data } = await call("resolve_value", { value: input });
      const paths = data.exact.map((t: any) => t.path);
      assert.equal(data.kind, "color");
      assert.ok(paths.includes("color.surface-page") && paths.includes("color.surface-button"), input);
      assert.equal(data.exact[0].layer, "semantic");
    }
  });

  test("resolve_value: a near colour returns the nearest semantic token", async () => {
    const { data } = await call("resolve_value", { value: "#F7941B" });
    assert.equal(data.exact.length, 0);
    assert.equal(data.nearest[0].path, "color.primary");
    assert.ok(data.nearest[0].distance < 2);
    assert.match(data.note, /drift/);
    const far = (await call("resolve_value", { value: "#00FF00" })).data;
    assert.match(far.note, /No close semantic colour/);
  });

  test("resolve_value: sizes by role, nearest on the 4px scale, rem and weights", async () => {
    const sixteen = (await call("resolve_value", { value: "16px" })).data;
    assert.ok(sixteen.exact.map((t: any) => t.path).includes("space.16"));
    const eight = (await call("resolve_value", { value: "8px" })).data.exact.map((t: any) => t.path);
    assert.ok(eight.includes("radius.card") && eight.includes("radius.chip") && eight.includes("space.8"));
    const off = (await call("resolve_value", { value: "15px" })).data;
    assert.equal(off.exact.filter((t: any) => t.path.startsWith("space.")).length, 0);
    assert.ok(off.nearest.some((t: any) => t.path === "space.16" && t.distance === 1));
    assert.match(off.note, /not on the 4px scale/);
    const rem = (await call("resolve_value", { value: "1.4rem" })).data;
    assert.equal(rem.normalized, "14px");
    assert.ok(rem.exact.map((t: any) => t.path).includes("font.size.14"));
    const bold = (await call("resolve_value", { value: "bold" })).data;
    assert.equal(bold.exact[0].path, "font.weight.bold");
    const inter = (await call("resolve_value", { value: "Inter" })).data;
    assert.ok(inter.exact.some((t: any) => t.path === "font.data"));
    assert.equal((await call("resolve_value", { value: "banana" })).data.kind, "unknown");
  });

  test("validate_file: reports 0 issues on the page, layout, global styles and every component", async () => {
    const files = [
      "src/pages/index.astro",
      "src/layouts/BaseLayout.astro",
      "src/styles/global.css",
      ...readdirSync(join(root, "src/components")).map((n) => `src/components/${n}/${n}.astro`),
    ];
    for (const f of files) {
      const { data, isError } = await call("validate_file", { path: f });
      assert.equal(isError, false, f);
      assert.equal(data.issueCount, 0, `${f}: ${JSON.stringify(data.issues)}`);
      assert.equal(data.ok, true);
    }
  });

  test("validate_file: the bad fixture is caught completely, with lines and fixes", async () => {
    const rel = "tests/fixtures/bad-section.astro";
    const { data } = await call("validate_file", { path: rel });
    const lines = readFileSync(join(root, rel), "utf8").split("\n");
    const lineOf = (needle: string) => lines.findIndex((l) => l.includes(needle)) + 1;
    const rules = new Set(data.issues.map((i: any) => i.rule));
    for (const rule of ["raw-color", "raw-spacing", "raw-font-size", "raw-line-height", "raw-font-weight", "raw-font-family", "raw-letter-spacing", "raw-radius", "raw-shadow", "raw-border-width", "raw-class-value", "raw-html-component", "unknown-token", "primitive-token"]) {
      assert.ok(rules.has(rule), `rule ${rule} must fire`);
    }
    const expectations: Array<[string, string, string]> = [
      ["<h2", "raw-html-component", "SectionTitle"],
      ["<article", "raw-html-component", "FeatureCard"],
      ["<svg", "raw-html-component", "Icon"],
      ["<table", "raw-html-component", "CurrencyTable"],
      ["<button", "raw-html-component", "Button"],
      ['class="btn"', "raw-html-component", "Button"],
      ["margin-top: 13px", "raw-spacing", "space"],
      ["padding: 13px 27px", "raw-spacing", "space"],
      ["border-radius: 6px", "raw-radius", "radius"],
      ["rgba(0, 0, 0, 0.3)", "raw-color", "color"],
      ["box-shadow:", "raw-shadow", "shadow-on-light"],
      ["font-family:", "raw-font-family", "font-body"],
      ["var(--color-brand)", "unknown-token", "color-primary"],
      ["var(--color-orange-500)", "primitive-token", "color-primary"],
    ];
    for (const [needle, rule, hint] of expectations) {
      const line = lineOf(needle);
      const hit = data.issues.find((i: any) => i.line === line && i.rule === rule);
      assert.ok(hit, `${rule} at line ${line} (${needle})`);
      assert.match(hit.suggestion, new RegExp(hint), `${rule} suggestion mentions ${hint}`);
    }
    for (const i of data.issues) {
      assert.ok(i.line >= 1 && i.column >= 1, "line and column");
      assert.ok(i.message && i.found && i.suggestion.length > 10, `${i.rule} has message, found and suggestion`);
    }
    assert.ok(data.issueCount >= 30, `expected at least 30 issues, got ${data.issueCount}`);
  });

  test("validate_file: refuses files outside the project and missing files", async () => {
    assert.equal((await call("validate_file", { path: "/etc/hosts" })).isError, true);
    assert.equal((await call("validate_file", { path: "src/nope.astro" })).isError, true);
  });
});

describe("validate_file in a project with an undocumented component", () => {
  let client: Client;
  let call: Awaited<ReturnType<typeof connect>>["call"];
  before(async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ds-"));
    for (const f of ["src/tokens/tokens.json", "src/styles/tokens.css", "docs/components.md"]) {
      mkdirSync(dirname(join(tmp, f)), { recursive: true });
      cpSync(join(root, f), join(tmp, f));
    }
    for (const n of readdirSync(join(root, "src/components"))) cpSync(join(root, "src/components", n), join(tmp, "src/components", n), { recursive: true });
    mkdirSync(join(tmp, "src/components/Ghost"), { recursive: true });
    writeFileSync(join(tmp, "src/components/Ghost/Ghost.astro"), '---\nexport interface Props { text: string }\nconst { text } = Astro.props;\n---\n<p class="ghost">{text}</p>\n<style>\n  .ghost { color: var(--color-text-strong); }\n</style>\n');
    ({ client, call } = await connect(tmp));
  });
  after(async () => { await client.close(); });

  test("flags a new component with no guide and no catalog entry", async () => {
    const { data } = await call("validate_file", { path: "src/components/Ghost/Ghost.astro" });
    const rules = data.issues.map((i: any) => i.rule);
    assert.equal(rules.filter((r: string) => r === "missing-docs").length, 2);
    assert.match(data.issues.map((i: any) => i.suggestion).join(" "), /Do \/ Don't/);
    assert.match(data.issues.map((i: any) => i.message).join(" "), /docs\/components\.md/);
  });

  test("a documented component in the same project stays clean", async () => {
    assert.equal((await call("validate_file", { path: "src/components/Badge/Badge.astro" })).data.issueCount, 0);
  });
});
