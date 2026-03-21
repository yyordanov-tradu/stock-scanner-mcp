import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const CNN_MOCK_RESPONSE = {
  fear_and_greed: { score: 50, rating: "neutral", previous_close: 48, previous_1_week: 45, previous_1_month: 40, previous_1_year: 55 },
  market_momentum_sp500: { score: 50, rating: "neutral" },
  stock_price_strength: { score: 50, rating: "neutral" },
  stock_price_breadth: { score: 50, rating: "neutral" },
  put_call_options: { score: 50, rating: "neutral" },
  market_volatility_vix: { score: 50, rating: "neutral" },
  junk_bond_demand: { score: 50, rating: "neutral" },
  safe_haven_demand: { score: 50, rating: "neutral" },
};

describe("getFearAndGreed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current score and sub-indicators", async () => {
    const mockResponse = {
      fear_and_greed: {
        score: 23,
        rating: "extreme fear",
        previous_close: 25,
        previous_1_week: 30,
        previous_1_month: 45,
        previous_1_year: 60,
      },
      market_momentum_sp500: { score: 20, rating: "extreme fear" },
      stock_price_strength: { score: 15, rating: "extreme fear" },
      stock_price_breadth: { score: 10, rating: "extreme fear" },
      put_call_options: { score: 30, rating: "fear" },
      market_volatility_vix: { score: 25, rating: "fear" },
      junk_bond_demand: { score: 35, rating: "fear" },
      safe_haven_demand: { score: 28, rating: "fear" },
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { getFearAndGreed } = await import("../client.js");
    const result = await getFearAndGreed();
    expect(result.score).toBe(23);
    expect(result.rating).toBe("extreme fear");
    expect(result.previousClose).toBe(25);
    expect(result.indicators).toHaveLength(7);
    expect(result.indicators[0]).toHaveProperty("name");
    expect(result.indicators[0]).toHaveProperty("score");
    expect(result.indicators[0]).toHaveProperty("rating");
  });

  it("sends browser User-Agent and CNN Referer headers", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => CNN_MOCK_RESPONSE,
    });

    const { getFearAndGreed } = await import("../client.js");
    await getFearAndGreed();

    const callArgs = (fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers["User-Agent"]).toContain("Mozilla/5.0");
    expect(headers["Referer"]).toBe("https://www.cnn.com/markets/fear-and-greed");
  });

  it("caches results", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => CNN_MOCK_RESPONSE,
    });

    const { getFearAndGreed } = await import("../client.js");
    await getFearAndGreed();
    await getFearAndGreed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("getCryptoFearAndGreed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current crypto sentiment score", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          value: "12",
          value_classification: "Extreme Fear",
          timestamp: "1774051200",
        }],
      }),
    });

    const { getCryptoFearAndGreed } = await import("../client.js");
    const result = await getCryptoFearAndGreed();
    expect(result.score).toBe(12);
    expect(result.rating).toBe("extreme fear");
    expect(result.timestamp).toContain("2026-");
  });

  it("caches results", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ value: "50", value_classification: "Neutral", timestamp: "1774051200" }],
      }),
    });

    const { getCryptoFearAndGreed } = await import("../client.js");
    await getCryptoFearAndGreed();
    await getCryptoFearAndGreed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
