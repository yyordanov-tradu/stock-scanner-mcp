import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const modulesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "modules");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return name.endsWith(".ts") ? [full] : [];
  });
}

// Every module cache must declare a literal namespace prefixed with its directory name, and
// namespaces must be unique: two caches sharing a namespace could serve each other's rows.
describe("TtlCache namespaces", () => {
  const constructions = sourceFiles(modulesDir).flatMap((file) => {
    const source = readFileSync(file, "utf-8");
    const moduleName = relative(modulesDir, file).split("/")[0];
    return [...source.matchAll(/new TtlCache<[^>]*>\(([^)]*)\)/g)].map((m) => ({ file, moduleName, args: m[1] }));
  });

  it("finds the module caches", () => {
    expect(constructions.length).toBeGreaterThanOrEqual(14);
  });

  it("passes a string-literal namespace prefixed with the module directory name", () => {
    for (const { file, moduleName, args } of constructions) {
      const literal = args.match(/,\s*"([^"]+)"\s*$/)?.[1];
      expect(literal, `${file}: ${args}`).toBeDefined();
      expect(literal === moduleName || literal?.startsWith(`${moduleName}-`), `${file}: namespace "${literal}"`).toBe(true);
    }
  });

  it("uses a unique namespace per cache", () => {
    const namespaces = constructions.map(({ args }) => args.match(/,\s*"([^"]+)"\s*$/)?.[1]);
    expect(new Set(namespaces).size).toBe(namespaces.length);
  });
});
