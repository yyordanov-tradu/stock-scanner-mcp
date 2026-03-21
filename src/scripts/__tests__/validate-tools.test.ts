import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("validate-tools script", () => {
  it("passes validation for all tools", () => {
    const result = execSync("npx tsx src/scripts/validate-tools.ts", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(result).toContain("All 47 tools passed validation");
  });

  it("reports correct tool count", () => {
    const result = execSync("npx tsx src/scripts/validate-tools.ts", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    // Verify all 9 modules are checked
    expect(result).toContain("tradingview (10 tools)");
    expect(result).toContain("tradingview-crypto (4 tools)");
    expect(result).toContain("sec-edgar (6 tools)");
    expect(result).toContain("coingecko (3 tools)");
    expect(result).toContain("options (5 tools)");
    expect(result).toContain("options-cboe (1 tools)");
    expect(result).toContain("finnhub (9 tools)");
    expect(result).toContain("alpha-vantage (5 tools)");
    expect(result).toContain("fred (4 tools)");
  });
});
