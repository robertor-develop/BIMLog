import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../");

export function readBimlogSource(relative: string): string {
  return fs.readFileSync(path.join(root, "artifacts", "bimlog", "src", relative), "utf8");
}
