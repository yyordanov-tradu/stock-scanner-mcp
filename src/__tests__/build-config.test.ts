import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const configPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "tsup.config.ts");

describe("build configuration", () => {
  it("keeps the node: prefix so the dynamic node:sqlite import survives bundling", () => {
    // tsup's default (removeNodeProtocol: true) emits import("sqlite"), which Node cannot resolve.
    const config = readFileSync(configPath, "utf-8");
    expect(config).toMatch(/removeNodeProtocol:\s*false/);
  });
});
