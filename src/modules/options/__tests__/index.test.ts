import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OptionChain } from "../client.js";

// Mock fetchOptionChain
vi.mock("../client.js", () => ({
  fetchOptionChain: vi.fn(),
}));

import { createOptionsModule } from "../index.js";
import { fetchOptionChain } from "../client.js";

const mockFetch = fetchOptionChain as ReturnType<typeof vi.fn>;

function makeMockChain(overrides: Partial<OptionChain> = {}): OptionChain {
  return {
    underlyingSymbol: "AAPL",
    underlyingPrice: 180.25,
    expirationDates: [1742515200, 1743120000],
    strikes: [170, 175, 180, 185, 190],
    calls: [
      { symbol: "AAPL260320C00170000", strike: 170, lastPrice: 12.0, bid: 11.9, ask: 12.1, change: 1.0, percentChange: 9, volume: 500, openInterest: 3000, impliedVolatility: 0.28, inTheMoney: true, delta: 0.85, gamma: 0.02, theta: -0.05, vega: 0.15 },
      { symbol: "AAPL260320C00175000", strike: 175, lastPrice: 8.0, bid: 7.9, ask: 8.1, change: 0.8, percentChange: 11, volume: 800, openInterest: 2500, impliedVolatility: 0.30, inTheMoney: true, delta: 0.7, gamma: 0.025, theta: -0.06, vega: 0.18 },
      { symbol: "AAPL260320C00180000", strike: 180, lastPrice: 5.5, bid: 5.4, ask: 5.6, change: 0.5, percentChange: 10, volume: 1234, openInterest: 5678, impliedVolatility: 0.32, inTheMoney: true, delta: 0.55, gamma: 0.03, theta: -0.07, vega: 0.2 },
      { symbol: "AAPL260320C00185000", strike: 185, lastPrice: 3.0, bid: 2.9, ask: 3.1, change: 0.3, percentChange: 11, volume: 600, openInterest: 2000, impliedVolatility: 0.33, inTheMoney: false, delta: 0.38, gamma: 0.028, theta: -0.065, vega: 0.19 },
      { symbol: "AAPL260320C00190000", strike: 190, lastPrice: 1.5, bid: 1.4, ask: 1.6, change: 0.1, percentChange: 7, volume: 300, openInterest: 1500, impliedVolatility: 0.35, inTheMoney: false, delta: 0.22, gamma: 0.02, theta: -0.05, vega: 0.15 },
    ],
    puts: [
      { symbol: "AAPL260320P00170000", strike: 170, lastPrice: 1.0, bid: 0.9, ask: 1.1, change: -0.1, percentChange: -9, volume: 200, openInterest: 1800, impliedVolatility: 0.27, inTheMoney: false, delta: -0.15, gamma: 0.02, theta: -0.04, vega: 0.14 },
      { symbol: "AAPL260320P00175000", strike: 175, lastPrice: 2.5, bid: 2.4, ask: 2.6, change: -0.2, percentChange: -7, volume: 400, openInterest: 2200, impliedVolatility: 0.29, inTheMoney: false, delta: -0.3, gamma: 0.025, theta: -0.055, vega: 0.17 },
      { symbol: "AAPL260320P00180000", strike: 180, lastPrice: 4.2, bid: 4.1, ask: 4.3, change: -0.3, percentChange: -5, volume: 987, openInterest: 4321, impliedVolatility: 0.30, inTheMoney: false, delta: -0.45, gamma: 0.03, theta: -0.065, vega: 0.2 },
      { symbol: "AAPL260320P00185000", strike: 185, lastPrice: 7.0, bid: 6.9, ask: 7.1, change: -0.5, percentChange: -7, volume: 350, openInterest: 1900, impliedVolatility: 0.32, inTheMoney: true, delta: -0.62, gamma: 0.028, theta: -0.06, vega: 0.19 },
      { symbol: "AAPL260320P00190000", strike: 190, lastPrice: 11.0, bid: 10.9, ask: 11.1, change: -0.8, percentChange: -7, volume: 150, openInterest: 1200, impliedVolatility: 0.34, inTheMoney: true, delta: -0.78, gamma: 0.02, theta: -0.05, vega: 0.15 },
    ],
    maxPain: 180,
    ...overrides,
  };
}

describe("createOptionsModule", () => {
  it("has 4 tools and no required env vars", () => {
    const mod = createOptionsModule();
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_expirations",
      "options_chain",
      "options_unusual_activity",
      "options_max_pain",
    ]);
  });
});

describe("options_expirations", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns expiration dates formatted as YYYY-MM-DD", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_expirations")!;
    const result = await tool.handler({ symbol: "AAPL" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBe("AAPL");
    expect(data.underlyingPrice).toBe(180.25);
    expect(data.expirations).toHaveLength(2);
    // Dates should be YYYY-MM-DD format
    for (const d of data.expirations) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("options_chain", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns both calls and puts by default", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls.length).toBeGreaterThan(0);
    expect(data.puts.length).toBeGreaterThan(0);
  });

  it("respects limit parameter", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", limit: 2 });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls).toHaveLength(2);
    expect(data.puts).toHaveLength(2);
  });

  it("filters by side=put (no calls returned)", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", side: "put" });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls).toHaveLength(0);
    expect(data.puts.length).toBeGreaterThan(0);
  });

  it("filters by side=call (no puts returned)", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", side: "call" });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls.length).toBeGreaterThan(0);
    expect(data.puts).toHaveLength(0);
  });

  it("caps limit at 200", async () => {
    // Create a chain with more than 200 contracts per side
    const bigCalls = Array.from({ length: 250 }, (_, i) => ({
      symbol: `C${i}`, strike: 100 + i, lastPrice: 1, bid: 1, ask: 1,
      change: 0, percentChange: 0, volume: 100, openInterest: 100,
      impliedVolatility: 0.3, inTheMoney: false, delta: 0.5, gamma: 0.01,
      theta: -0.01, vega: 0.1,
    }));
    mockFetch.mockResolvedValue(makeMockChain({ calls: bigCalls }));

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", limit: 999 });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls).toHaveLength(200);
  });
});

describe("options_unusual_activity", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("flags contracts with high volume/OI ratio", async () => {
    const chain = makeMockChain({
      calls: [
        // volume/OI = 2000/50 = 40 → unusual
        { symbol: "UNUSUAL_CALL", strike: 180, lastPrice: 5, bid: 5, ask: 5, change: 0, percentChange: 0, volume: 2000, openInterest: 50, impliedVolatility: 0.3, inTheMoney: false, delta: 0.5, gamma: 0.01, theta: -0.01, vega: 0.1 },
        // volume/OI = 50/5000 = 0.01 → not unusual
        { symbol: "NORMAL_CALL", strike: 185, lastPrice: 3, bid: 3, ask: 3, change: 0, percentChange: 0, volume: 50, openInterest: 5000, impliedVolatility: 0.3, inTheMoney: false, delta: 0.3, gamma: 0.01, theta: -0.01, vega: 0.1 },
      ],
      puts: [
        // volume/OI = 500/20 = 25 → unusual
        { symbol: "UNUSUAL_PUT", strike: 175, lastPrice: 2, bid: 2, ask: 2, change: 0, percentChange: 0, volume: 500, openInterest: 20, impliedVolatility: 0.3, inTheMoney: false, delta: -0.3, gamma: 0.01, theta: -0.01, vega: 0.1 },
      ],
    });
    mockFetch.mockResolvedValue(chain);

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_unusual_activity")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    expect(data.unusual.length).toBe(2);
    const symbols = data.unusual.map((u: any) => u.symbol);
    expect(symbols).toContain("UNUSUAL_CALL");
    expect(symbols).toContain("UNUSUAL_PUT");
    expect(symbols).not.toContain("NORMAL_CALL");
  });

  it("respects min_volume filter", async () => {
    const chain = makeMockChain({
      calls: [
        // High ratio but volume below default 100 threshold
        { symbol: "LOW_VOL", strike: 180, lastPrice: 5, bid: 5, ask: 5, change: 0, percentChange: 0, volume: 50, openInterest: 10, impliedVolatility: 0.3, inTheMoney: false, delta: 0.5, gamma: 0.01, theta: -0.01, vega: 0.1 },
      ],
      puts: [],
    });
    mockFetch.mockResolvedValue(chain);

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_unusual_activity")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    expect(data.unusual).toHaveLength(0);
  });

  it("filters by side parameter", async () => {
    const chain = makeMockChain({
      calls: [
        { symbol: "UNUSUAL_CALL", strike: 180, lastPrice: 5, bid: 5, ask: 5, change: 0, percentChange: 0, volume: 2000, openInterest: 50, impliedVolatility: 0.3, inTheMoney: false, delta: 0.5, gamma: 0.01, theta: -0.01, vega: 0.1 },
      ],
      puts: [
        { symbol: "UNUSUAL_PUT", strike: 175, lastPrice: 2, bid: 2, ask: 2, change: 0, percentChange: 0, volume: 500, openInterest: 20, impliedVolatility: 0.3, inTheMoney: false, delta: -0.3, gamma: 0.01, theta: -0.01, vega: 0.1 },
      ],
    });
    mockFetch.mockResolvedValue(chain);

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_unusual_activity")!;
    const result = await tool.handler({ symbol: "AAPL", side: "call" });

    const data = JSON.parse(result.content[0].text);
    expect(data.unusual).toHaveLength(1);
    expect(data.unusual[0].symbol).toBe("UNUSUAL_CALL");
  });
});

describe("options_max_pain", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns max pain strike from chain", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_max_pain")!;
    const result = await tool.handler({ symbol: "AAPL" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBe("AAPL");
    expect(data.underlyingPrice).toBe(180.25);
    expect(data.maxPain).toBe(180);
    expect(data.expiration).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns error JSON when fetchOptionChain throws", async () => {
    mockFetch.mockRejectedValue(new Error("No options data found for symbol: INVALID"));
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_max_pain")!;
    const result = await tool.handler({ symbol: "INVALID" });

    // withMetadata catches errors and returns isError: true
    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe(true);
    expect(data.message).toContain("No options data found");
  });
});
