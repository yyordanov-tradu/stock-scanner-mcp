import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCoinDetail, getTrending, getGlobal } from "../client.js";

describe("getCoinDetail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches coin details and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        market_data: {
          current_price: { usd: 42000 },
          market_cap: { usd: 820000000000 },
          price_change_24h: 1200,
          price_change_percentage_24h: 2.94,
          total_volume: { usd: 25000000000 },
          high_24h: { usd: 42500 },
          low_24h: { usd: 40800 },
          ath: { usd: 69000 },
          ath_change_percentage: { usd: -39.13 },
        },
        description: { en: "Bitcoin is a decentralized digital currency." },
      }),
    });

    const coin = await getCoinDetail("bitcoin");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.coingecko.com/api/v3/coins/bitcoin"),
      expect.anything(),
    );
    expect(coin.id).toBe("bitcoin");
    expect(coin.currentPrice).toBe(42000);
    expect(coin.marketCap).toBe(820000000000);
    expect(coin.priceChangePercent24h).toBe(2.94);
  });
});

describe("getTrending", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches trending coins", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: [
          {
            item: {
              id: "pepe", name: "Pepe", symbol: "pepe",
              market_cap_rank: 50, price_btc: 0.000000001, score: 0,
            },
          },
        ],
      }),
    });

    const trending = await getTrending();
    expect(trending).toHaveLength(1);
    expect(trending[0].id).toBe("pepe");
    expect(trending[0].name).toBe("Pepe");
  });
});

describe("getGlobal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches global market data", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total_market_cap: { usd: 1700000000000 },
          total_volume: { usd: 80000000000 },
          market_cap_percentage: { btc: 48.5, eth: 17.2 },
          active_cryptocurrencies: 12000,
          market_cap_change_percentage_24h_usd: 1.5,
        },
      }),
    });

    const global = await getGlobal();
    expect(global.totalMarketCap).toBe(1700000000000);
    expect(global.btcDominance).toBe(48.5);
    expect(global.activeCryptocurrencies).toBe(12000);
  });
});

describe("createCoingeckoModule", () => {
  it("returns module with 3 tools and no required env vars", async () => {
    const { createCoingeckoModule } = await import("../index.js");
    const mod = createCoingeckoModule();
    expect(mod.name).toBe("coingecko");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(3);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "coingecko_coin", "coingecko_trending", "coingecko_global",
    ]);
  });
});
