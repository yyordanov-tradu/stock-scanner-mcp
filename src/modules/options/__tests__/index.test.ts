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
  it("has 5 tools and no required env vars", () => {
    const mod = createOptionsModule();
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(5);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_expirations",
      "options_chain",
      "options_unusual_activity",
      "options_max_pain",
      "options_implied_move",
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

  it("defaults to ±20% ATM strike range", async () => {
    // underlyingPrice = 180.25, so ±20% = 144.20 – 216.30
    // strikes 170-190 are all within range, so all 5 contracts per side should pass
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    // All strikes 170-190 are within ±20% of 180.25
    expect(data.calls).toHaveLength(5);
    expect(data.puts).toHaveLength(5);
  });

  it("filters out-of-range strikes with default ±20% ATM", async () => {
    // Create chain with wide strike range: $50 through $350 for a $180 stock
    // ±20% of 180 = 144 – 216
    const wideChain = makeMockChain({
      calls: [
        { symbol: "C50", strike: 50, lastPrice: 130, bid: 130, ask: 130, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 1.0, gamma: 0, theta: 0, vega: 0 },
        { symbol: "C100", strike: 100, lastPrice: 80, bid: 80, ask: 80, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 0.95, gamma: 0.01, theta: -0.01, vega: 0.05 },
        { symbol: "C150", strike: 150, lastPrice: 32, bid: 32, ask: 32, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 0.8, gamma: 0.02, theta: -0.05, vega: 0.15 },
        { symbol: "C180", strike: 180, lastPrice: 5, bid: 5, ask: 5, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 0.55, gamma: 0.03, theta: -0.07, vega: 0.2 },
        { symbol: "C200", strike: 200, lastPrice: 1, bid: 1, ask: 1, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: false, delta: 0.25, gamma: 0.02, theta: -0.03, vega: 0.1 },
        { symbol: "C250", strike: 250, lastPrice: 0.1, bid: 0.1, ask: 0.1, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: false, delta: 0.05, gamma: 0.005, theta: -0.01, vega: 0.02 },
        { symbol: "C350", strike: 350, lastPrice: 0.01, bid: 0.01, ask: 0.01, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: false, delta: 0.01, gamma: 0.001, theta: -0.005, vega: 0.005 },
      ],
      puts: [],
    });
    mockFetch.mockResolvedValue(wideChain);

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    // Only strikes 150, 180, 200 are within 144.20 – 216.30
    const strikes = data.calls.map((c: any) => c.strike);
    expect(strikes).toEqual([150, 180, 200]);
  });

  it("respects explicit strike_min and strike_max", async () => {
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", strike_min: 175, strike_max: 185 });

    const data = JSON.parse(result.content[0].text);
    const callStrikes = data.calls.map((c: any) => c.strike);
    expect(callStrikes).toEqual([175, 180, 185]);
    const putStrikes = data.puts.map((p: any) => p.strike);
    expect(putStrikes).toEqual([175, 180, 185]);
  });

  it("returns all strikes when all_strikes=true", async () => {
    // Use wide chain that would normally be filtered
    const wideChain = makeMockChain({
      calls: [
        { symbol: "C50", strike: 50, lastPrice: 130, bid: 130, ask: 130, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 1.0, gamma: 0, theta: 0, vega: 0 },
        { symbol: "C180", strike: 180, lastPrice: 5, bid: 5, ask: 5, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: true, delta: 0.55, gamma: 0.03, theta: -0.07, vega: 0.2 },
        { symbol: "C350", strike: 350, lastPrice: 0.01, bid: 0.01, ask: 0.01, change: 0, percentChange: 0, volume: 100, openInterest: 100, impliedVolatility: 0.3, inTheMoney: false, delta: 0.01, gamma: 0.001, theta: -0.005, vega: 0.005 },
      ],
      puts: [],
    });
    mockFetch.mockResolvedValue(wideChain);

    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_chain")!;
    const result = await tool.handler({ symbol: "AAPL", all_strikes: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.calls).toHaveLength(3);
    expect(data.calls.map((c: any) => c.strike)).toEqual([50, 180, 350]);
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
    const result = await tool.handler({ symbol: "AAPL", limit: 999, all_strikes: true });

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

describe("options_implied_move", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("calculates implied move from ATM straddle", async () => {
    // underlyingPrice = 180.25
    // ATM call (strike 180) lastPrice = 5.5
    // ATM put (strike 180) lastPrice = 4.2
    // straddle = 9.7, implied move = 9.7/180.25 = 5.38%
    mockFetch.mockResolvedValue(makeMockChain());
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_implied_move")!;
    const result = await tool.handler({ symbol: "AAPL" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBe("AAPL");
    expect(data.underlyingPrice).toBe(180.25);
    expect(data.atmCallStrike).toBe(180);
    expect(data.atmPutStrike).toBe(180);
    expect(data.atmCallPrice).toBe(5.5);
    expect(data.atmPutPrice).toBe(4.2);
    expect(data.straddlePrice).toBe(9.7);
    expect(data.impliedMove).toBeCloseTo(5.38, 1);
    expect(data.impliedMoveAbsolute).toBe(9.7);
    expect(data.expectedRange.low).toBeCloseTo(170.55, 1);
    expect(data.expectedRange.high).toBeCloseTo(189.95, 1);
    expect(data.impliedVolatility).toBeGreaterThan(0);
    expect(data.expiration).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("finds closest ATM strike when no exact match", async () => {
    // underlyingPrice = 182 — between 180 and 185 strikes
    const chain = makeMockChain({ underlyingPrice: 182 });
    mockFetch.mockResolvedValue(chain);
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_implied_move")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    // 180 is closer to 182 than 185
    expect(data.atmCallStrike).toBe(180);
    expect(data.atmPutStrike).toBe(180);
  });

  it("returns error when no options data available", async () => {
    mockFetch.mockResolvedValue(makeMockChain({ calls: [], puts: [] }));
    const mod = createOptionsModule();
    const tool = mod.tools.find(t => t.name === "options_implied_move")!;
    const result = await tool.handler({ symbol: "AAPL" });

    const data = JSON.parse(result.content[0].text);
    expect(data.error).toContain("Insufficient");
  });
});
