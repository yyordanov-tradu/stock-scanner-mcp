import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("validate-tools script", () => {
  it("passes validation for all tools", () => {
    // The script exits with non-zero exit code if it finds errors.
    // It might output warnings but still exit with 0.
    let output = "";
    try {
      output = execSync("npx tsx src/scripts/validate-tools.ts", {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
    } catch (e: any) {
      console.error(e.stdout);
      throw e;
    }
    
    expect(output).toContain("TOOLS PASSED VALIDATION");
  });

  it("checks all 13 modules", () => {
    const result = execSync("npx tsx src/scripts/validate-tools.ts", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    const moduleNames = [
      "tradingview",
      "tradingview-crypto",
      "sec-edgar",
      "coingecko",
      "options",
      "options-cboe",
      "finnhub",
      "alpha-vantage",
      "fred",
      "sentiment",
      "frankfurter",
      "reddit",
      "workspace",
    ];

    expect(moduleNames).toHaveLength(13);
    for (const name of moduleNames) {
      expect(result).toContain(name);
    }
  });
});
