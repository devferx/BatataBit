// Servidor MCP "batatabit-ds" (stdio): consulta de componentes y tokens y validación de archivos.
// Todo se lee en tiempo de ejecución de src/tokens/tokens.json, las guías de los componentes y sus interfaces Props.
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod";
import { getComponent, listComponents } from "./lib/components.ts";
import { categories, getTokens, resolveValue } from "./lib/tokens.ts";
import { validateFile } from "./lib/validate.ts";

const server = new McpServer({ name: "batatabit-ds", version: "1.0.0" });

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string, extra: Record<string, unknown> = {}) => ({
  isError: true,
  content: [{ type: "text" as const, text: JSON.stringify({ error: message, ...extra }, null, 2) }],
});

server.registerTool(
  "list_components",
  {
    title: "List components",
    description: "List every component of the Batatabit design system with its purpose and the path to its guide. Call this before writing any markup: reuse a component when one fits.",
    inputSchema: z.object({}),
  },
  async () => ok(listComponents()),
);

server.registerTool(
  "get_component",
  {
    title: "Get a component",
    description: "Return the full guide of a component (when to use, variants, tokens, accessibility, examples) and its parsed Props (name, type, required, default, description), read from its Props interface.",
    inputSchema: z.object({ name: z.string().describe('Component name, for example "Button" or "PlanCard".') }),
  },
  async ({ name }) => {
    const result = getComponent(name);
    if ("error" in result) return fail(result.error, { available: result.available });
    return ok(result);
  },
);

server.registerTool(
  "get_tokens",
  {
    title: "Get design tokens",
    description: `Return design tokens with their resolved values, CSS variable and description. Defaults to the semantic layer, the one components consume. Categories: ${categories().join(", ")}.`,
    inputSchema: z.object({
      layer: z.enum(["semantic", "primitive", "all"]).optional().describe("Token layer. Default: semantic."),
      category: z.string().optional().describe("First segment of the token path, for example color, text, space, radius, shadow, layout."),
      search: z.string().optional().describe("Case-insensitive text to look for in the token path or description."),
    }),
  },
  async (filter) => ok(getTokens(filter)),
);

server.registerTool(
  "resolve_value",
  {
    title: "Resolve a raw value to tokens",
    description: "Given a raw value from Figma or CSS (a hex or rgb colour, a size in px or rem, a font weight or a font family), return the tokens with that exact value and their descriptions, or the nearest ones when there is no exact match. Use it for every value read from a design before writing code.",
    inputSchema: z.object({ value: z.string().describe('For example "#FAF8F7", "rgb(247, 147, 26)", "14px", "1.6rem", "700" or "Inter".') }),
  },
  async ({ value }) => ok(resolveValue(value)),
);

server.registerTool(
  "validate_file",
  {
    title: "Validate a file against the design system",
    description: "Check an .astro or .css file inside the project and report hardcoded colours, spacing, sizes, radii, shadows and fonts outside tokens; raw HTML where a catalog component exists; unknown or primitive tokens; and components without documentation. Each issue has a line, a column, a rule and a fix suggestion. Run it on every file you write or change.",
    inputSchema: z.object({ path: z.string().describe("Path to the file, relative to the project root or absolute.") }),
  },
  async ({ path }) => {
    try {
      return ok(validateFile(path));
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
);

await server.connect(new StdioServerTransport());
console.error("batatabit-ds MCP server running on stdio");
