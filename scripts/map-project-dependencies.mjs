import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = path.join(root, "lib", "db", "src", "schema");
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? files(full) : entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
});

function declarations() {
  const tables = [];
  for (const file of files(schemaRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const starts = [...source.matchAll(/export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*["'`]([^"'`]+)["'`]/g)];
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i].index;
      const end = starts[i + 1]?.index ?? source.length;
      tables.push({ variable: starts[i][1], name: starts[i][2], body: source.slice(start, end) });
    }
  }
  return tables;
}

export function mapProjectDependencies() {
  const tables = declarations();
  const names = new Map(tables.map((t) => [t.variable, t.name]));
  const edges = tables.flatMap((t) => [...t.body.matchAll(/references\s*\(\s*\(\)\s*=>\s*(\w+)\./g)]
    .map((m) => ({ child: t.name, parent: names.get(m[1]) })).filter((e) => e.parent));
  const complete = new Set(tables.filter((t) => /\b\w*ProjectId\s*:|["'`]\w*project_id["'`]/i.test(t.body)).map((t) => t.name));
  complete.add("projects");
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of edges) if (complete.has(edge.parent) && !complete.has(edge.child)) { complete.add(edge.child); changed = true; }
  }
  return { schemaTableCount: new Set(tables.map((t) => t.name)).size,
    completeProjectDependentTableCount: [...complete].filter((n) => n !== "projects").length,
    completeProjectDependentTables: [...complete].filter((n) => n !== "projects").sort() };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) console.log(JSON.stringify(mapProjectDependencies(), null, 2));
