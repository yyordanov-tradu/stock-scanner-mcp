import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { validateDocToolReferences } from "../validate-doc-tool-references.js";

describe("validate-doc-tool-references script", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("passes for current skills and commands", () => {
    const output = execSync("npx tsx src/scripts/validate-doc-tool-references.ts", {
      encoding: "utf8",
      cwd: process.cwd(),
    });

    expect(output).toContain("MCP tool references are registered");
  });

  it("reports stale tool-like references and ignores non-tool identifiers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "doc-tool-refs-"));
    tempDirs.push(root);

    const docPath = path.join(root, "SKILL.md");
    await writeFile(
      docPath,
      [
        "# Synthetic Skill",
        "",
        "Use `market_breadth` with `treasury_10y` context.",
        "Do not use stale `tradingview_scan_indicators`.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await validateDocToolReferences([root]);

    expect(result.toolReferences).toBe(2);
    expect(result.unknownReferences).toHaveLength(1);
    expect(result.unknownReferences[0]).toMatchObject({
      file: docPath,
      line: 4,
      name: "tradingview_scan_indicators",
    });
    expect(result.unknownReferences[0].suggestion).toBeDefined();
  });
});
