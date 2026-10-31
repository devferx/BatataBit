import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz del proyecto: `BATATABIT_ROOT` o dos niveles por encima de mcp/src/lib. */
export const projectRoot: string = resolve(
  process.env.BATATABIT_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."),
);
