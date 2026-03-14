import { describe, it, expect } from "vitest";
import { resolveTicker } from "../resolver.js";

describe("resolveTicker", () => {
  it("normalizes lowercase and whitespace", () => {
    const res = resolveTicker("  aapl  ");
    expect(res.ticker).toBe("AAPL");
    expect(res.full).toBe("NASDAQ:AAPL");
  });

  it("handles existing exchange prefix", () => {
    const res = resolveTicker("NYSE:IBM");
    expect(res.ticker).toBe("IBM");
    expect(res.exchange).toBe("NYSE");
    expect(res.full).toBe("NYSE:IBM");
  });

  it("identifies common crypto", () => {
    const res = resolveTicker("BTC");
    expect(res.isCrypto).toBe(true);
    expect(res.ticker).toBe("BTC");
  });

  it("respects custom default exchange", () => {
    const res = resolveTicker("IBM", "NYSE");
    expect(res.full).toBe("NYSE:IBM");
  });
});
