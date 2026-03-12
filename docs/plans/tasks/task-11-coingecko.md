# Task 11: CoinGecko Crypto Data Module

**Files:**
- Create: `src/modules/coingecko/client.ts`
- Create: `src/modules/coingecko/index.ts`
- Test: `src/modules/coingecko/__tests__/client.test.ts`

---

**Step 1: Write the test**

Create `src/modules/coingecko/__tests__/client.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/coingecko/__tests__/client.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the code**

Create `src/modules/coingecko/client.ts`:

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 60 * 1000; // 1 minute

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChangePercent: number;
  description: string;
}

export async function getCoinDetail(coinId: string): Promise<CoinDetail> {
  const cacheKey = `coin:${coinId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CoinDetail;

  const data = await httpGet<{
    id: string;
    symbol: string;
    name: string;
    market_data: {
      current_price: { usd: number };
      market_cap: { usd: number };
      price_change_24h: number;
      price_change_percentage_24h: number;
      total_volume: { usd: number };
      high_24h: { usd: number };
      low_24h: { usd: number };
      ath: { usd: number };
      ath_change_percentage: { usd: number };
    };
    description: { en: string };
  }>(`${BASE_URL}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`);

  const coin: CoinDetail = {
    id: data.id,
    symbol: data.symbol,
    name: data.name,
    currentPrice: data.market_data.current_price.usd,
    marketCap: data.market_data.market_cap.usd,
    priceChange24h: data.market_data.price_change_24h,
    priceChangePercent24h: data.market_data.price_change_percentage_24h,
    totalVolume: data.market_data.total_volume.usd,
    high24h: data.market_data.high_24h.usd,
    low24h: data.market_data.low_24h.usd,
    ath: data.market_data.ath.usd,
    athChangePercent: data.market_data.ath_change_percentage.usd,
    description: data.description.en.slice(0, 500),
  };

  cache.set(cacheKey, coin);
  return coin;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number;
  priceBtc: number;
  score: number;
}

export async function getTrending(): Promise<TrendingCoin[]> {
  const cacheKey = "trending";
  const cached = cache.get(cacheKey);
  if (cached) return cached as TrendingCoin[];

  const data = await httpGet<{
    coins: Array<{
      item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
        price_btc: number;
        score: number;
      };
    }>;
  }>(`${BASE_URL}/search/trending`);

  const trending: TrendingCoin[] = data.coins.map((c) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    marketCapRank: c.item.market_cap_rank,
    priceBtc: c.item.price_btc,
    score: c.item.score,
  }));

  cache.set(cacheKey, trending);
  return trending;
}

export interface GlobalData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  marketCapChangePercent24h: number;
}

export async function getGlobal(): Promise<GlobalData> {
  const cacheKey = "global";
  const cached = cache.get(cacheKey);
  if (cached) return cached as GlobalData;

  const data = await httpGet<{
    data: {
      total_market_cap: { usd: number };
      total_volume: { usd: number };
      market_cap_percentage: { btc: number; eth: number };
      active_cryptocurrencies: number;
      market_cap_change_percentage_24h_usd: number;
    };
  }>(`${BASE_URL}/global`);

  const global: GlobalData = {
    totalMarketCap: data.data.total_market_cap.usd,
    totalVolume24h: data.data.total_volume.usd,
    btcDominance: data.data.market_cap_percentage.btc,
    ethDominance: data.data.market_cap_percentage.eth,
    activeCryptocurrencies: data.data.active_cryptocurrencies,
    marketCapChangePercent24h: data.data.market_cap_change_percentage_24h_usd,
  };

  cache.set(cacheKey, global);
  return global;
}
```

Create `src/modules/coingecko/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { getCoinDetail, getTrending, getGlobal } from "./client.js";

const coinTool: ToolDefinition = {
  name: "coingecko_coin",
  description: "Get detailed cryptocurrency info from CoinGecko. Use slug IDs (e.g. 'bitcoin', 'ethereum', 'solana'), NOT ticker symbols.",
  inputSchema: {
    coinId: z.string().describe("CoinGecko coin ID / slug (e.g. 'bitcoin', 'ethereum', 'cardano')"),
  },
  handler: async (params) => {
    try {
      const coin = await getCoinDetail(params.coinId as string);
      return successResult(JSON.stringify(coin, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const trendingTool: ToolDefinition = {
  name: "coingecko_trending",
  description: "Get trending cryptocurrencies on CoinGecko (top 7 by search popularity in last 24h).",
  inputSchema: {},
  handler: async () => {
    try {
      const trending = await getTrending();
      return successResult(JSON.stringify(trending, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const globalTool: ToolDefinition = {
  name: "coingecko_global",
  description: "Get global cryptocurrency market statistics: total market cap, 24h volume, BTC/ETH dominance.",
  inputSchema: {},
  handler: async () => {
    try {
      const global = await getGlobal();
      return successResult(JSON.stringify(global, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createCoingeckoModule(): ModuleDefinition {
  return {
    name: "coingecko",
    description: "CoinGecko crypto data -- coin details, trending coins, and global market stats",
    requiredEnvVars: [],
    tools: [coinTool, trendingTool, globalTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/coingecko/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/coingecko/client.ts src/modules/coingecko/index.ts src/modules/coingecko/__tests__/client.test.ts
git commit -m "feat: add CoinGecko crypto data module with 3 tools"
```
