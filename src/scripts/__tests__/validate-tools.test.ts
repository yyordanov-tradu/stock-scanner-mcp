import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("validate-tools script", () => {
  it("passes validation for all tools", () => {
    const result = execSync("npx tsx src/scripts/validate-tools.ts", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(result).toMatch(/All \d+ tools passed validation/);
  });

  it("checks all 9 modules", () => {
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
    ];

    for (const name of moduleNames) {
      expect(result).toContain(`${name} (`);
    }
  });

  it("exits with code 0 on success", () => {
    // execSync throws on non-zero exit code, so if this doesn't throw, exit code is 0
    expect(() =>
      execSync("npx tsx src/scripts/validate-tools.ts", {
        encoding: "utf-8",
        cwd: process.cwd(),
      }),
    ).not.toThrow();
  });
});
