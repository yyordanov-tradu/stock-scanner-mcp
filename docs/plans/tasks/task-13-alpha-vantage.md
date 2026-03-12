# Task 13: Alpha Vantage Module

**Files:**
- Create: `src/modules/alpha-vantage/client.ts`
- Create: `src/modules/alpha-vantage/index.ts`
- Test: `src/modules/alpha-vantage/__tests__/client.test.ts`

**API notes:**
- Base URL: `https://www.alphavantage.co/query`
- Auth: `apikey` query parameter (`ALPHA_VANTAGE_API_KEY`)
- Rate limit: 5 requests/min, 25/day on free tier

---

**Step 1: Write the test**

Create `src/modules/alpha-vantage/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getQuote, getDailyPrices, getOverview } from "../client.js";

describe("getQuote", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches quote and maps response fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "Global Quote": {
          "01. symbol": "AAPL",
          "02. open": "150.00",
          "03. high": "152.00",
          "04. low": "149.50",
          "05. price": "151.25",
          "06. volume": "45000000",
          "07. latest trading day": "2024-03-15",
          "08. previous close": "149.80",
          "09. change": "1.45",
          "10. change percent": "0.9680%",
        },
      }),
    });

    const quote = await getQuote("test-key", "AAPL");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("function=GLOBAL_QUOTE");
    expect(calledUrl).toContain("symbol=AAPL");
    expect(calledUrl).toContain("apikey=test-key");
    expect(quote.symbol).toBe("AAPL");
    expect(quote.price).toBe(151.25);
    expect(quote.volume).toBe(45000000);
    expect(quote.change).toBe(1.45);
  });
});

describe("getDailyPrices", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches daily prices and limits results", async () => {
    const timeSeries: Record<string, Record<string, string>> = {};
    for (let i = 1; i <= 10; i++) {
      timeSeries[`2024-03-${String(i).padStart(2, "0")}`] = {
        "1. open": "150.00",
        "2. high": "152.00",
        "3. low": "149.00",
        "4. close": "151.00",
        "5. volume": "5000000",
      };
    }

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ "Time Series (Daily)": timeSeries }),
    });

    const prices = await getDailyPrices("key", "AAPL", 5);
    expect(prices).toHaveLength(5);
    expect(prices[0].close).toBe(151);
    expect(prices[0].volume).toBe(5000000);
  });
});

describe("getOverview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches company overview", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        Symbol: "AAPL",
        Name: "Apple Inc",
        Description: "Apple Inc. designs, manufactures, and markets smartphones.",
        Exchange: "NASDAQ",
        Sector: "TECHNOLOGY",
        Industry: "ELECTRONIC COMPUTERS",
        MarketCapitalization: "2500000000000",
        PERatio: "28.50",
        PEGRatio: "2.10",
        BookValue: "4.15",
        DividendYield: "0.0055",
        EPS: "6.35",
        RevenuePerShareTTM: "24.50",
        ProfitMargin: "0.255",
        "52WeekHigh": "199.62",
        "52WeekLow": "143.90",
        AnalystTargetPrice: "195.00",
      }),
    });

    const overview = await getOverview("key", "AAPL");
    expect(overview.symbol).toBe("AAPL");
    expect(overview.name).toBe("Apple Inc");
    expect(overview.marketCap).toBe(2500000000000);
    expect(overview.peRatio).toBe(28.5);
    expect(overview.sector).toBe("TECHNOLOGY");
  });
});

describe("createAlphaVantageModule", () => {
  it("returns module with 3 tools and requires ALPHA_VANTAGE_API_KEY", async () => {
    const { createAlphaVantageModule } = await import("../index.js");
    const mod = createAlphaVantageModule("test-key");
    expect(mod.name).toBe("alpha-vantage");
    expect(mod.requiredEnvVars).toEqual(["ALPHA_VANTAGE_API_KEY"]);
    expect(mod.tools).toHaveLength(3);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "alphavantage_quote", "alphavantage_daily", "alphavantage_overview",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/alpha-vantage/__tests__/client.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the code**

Create `src/modules/alpha-vantage/client.ts`:

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_TTL = 60 * 1000; // 1 minute

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface StockQuote {
  symbol: string;
  open: number;
  high: number;
  low: number;
  price: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  change: number;
  changePercent: string;
}

export async function getQuote(apiKey: string, symbol: string): Promise<StockQuote> {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as StockQuote;

  const data = await httpGet<{
    "Global Quote": {
      "01. symbol": string;
      "02. open": string;
      "03. high": string;
      "04. low": string;
      "05. price": string;
      "06. volume": string;
      "07. latest trading day": string;
      "08. previous close": string;
      "09. change": string;
      "10. change percent": string;
    };
  }>(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);

  const gq = data["Global Quote"];
  const quote: StockQuote = {
    symbol: gq["01. symbol"],
    open: parseFloat(gq["02. open"]),
    high: parseFloat(gq["03. high"]),
    low: parseFloat(gq["04. low"]),
    price: parseFloat(gq["05. price"]),
    volume: parseInt(gq["06. volume"], 10),
    latestTradingDay: gq["07. latest trading day"],
    previousClose: parseFloat(gq["08. previous close"]),
    change: parseFloat(gq["09. change"]),
    changePercent: gq["10. change percent"],
  };

  cache.set(cacheKey, quote);
  return quote;
}

export interface DailyPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getDailyPrices(apiKey: string, symbol: string, limit: number = 30): Promise<DailyPrice[]> {
  const cacheKey = `daily:${symbol}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as DailyPrice[];

  const data = await httpGet<{
    "Time Series (Daily)": Record<string, {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }>;
  }>(`${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${apiKey}`);

  const timeSeries = data["Time Series (Daily)"];
  const prices: DailyPrice[] = Object.entries(timeSeries)
    .slice(0, limit)
    .map(([date, values]) => ({
      date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: parseInt(values["5. volume"], 10),
    }));

  cache.set(cacheKey, prices);
  return prices;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  bookValue: number;
  dividendYield: number;
  eps: number;
  revenuePerShare: number;
  profitMargin: number;
  week52High: number;
  week52Low: number;
  analystTargetPrice: number;
}

export async function getOverview(apiKey: string, symbol: string): Promise<CompanyOverview> {
  const cacheKey = `overview:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyOverview;

  const data = await httpGet<Record<string, string>>(
    `${BASE_URL}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
  );

  const overview: CompanyOverview = {
    symbol: data.Symbol,
    name: data.Name,
    description: (data.Description ?? "").slice(0, 500),
    exchange: data.Exchange,
    sector: data.Sector,
    industry: data.Industry,
    marketCap: parseFloat(data.MarketCapitalization) || 0,
    peRatio: parseFloat(data.PERatio) || 0,
    pegRatio: parseFloat(data.PEGRatio) || 0,
    bookValue: parseFloat(data.BookValue) || 0,
    dividendYield: parseFloat(data.DividendYield) || 0,
    eps: parseFloat(data.EPS) || 0,
    revenuePerShare: parseFloat(data.RevenuePerShareTTM) || 0,
    profitMargin: parseFloat(data.ProfitMargin) || 0,
    week52High: parseFloat(data["52WeekHigh"]) || 0,
    week52Low: parseFloat(data["52WeekLow"]) || 0,
    analystTargetPrice: parseFloat(data.AnalystTargetPrice) || 0,
  };

  cache.set(cacheKey, overview);
  return overview;
}
```

Create `src/modules/alpha-vantage/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { getQuote, getDailyPrices, getOverview } from "./client.js";

export function createAlphaVantageModule(apiKey: string): ModuleDefinition {
  const quoteTool: ToolDefinition = {
    name: "alphavantage_quote",
    description: "Get real-time stock quote from Alpha Vantage. Returns price, change, volume, and day range. Rate limit: 5 calls/min on free tier.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT')"),
    },
    handler: async (params) => {
      try {
        const quote = await getQuote(apiKey, params.symbol as string);
        return successResult(JSON.stringify(quote, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const dailyTool: ToolDefinition = {
    name: "alphavantage_daily",
    description: "Get daily OHLCV price history from Alpha Vantage. Returns up to 100 most recent trading days.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      limit: z.number().optional().describe("Number of days to return (default: 30, max: 100)"),
    },
    handler: async (params) => {
      try {
        const prices = await getDailyPrices(
          apiKey,
          params.symbol as string,
          Math.min((params.limit as number) ?? 30, 100),
        );
        return successResult(JSON.stringify(prices, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const overviewTool: ToolDefinition = {
    name: "alphavantage_overview",
    description: "Get company fundamentals from Alpha Vantage. Includes PE ratio, market cap, sector, industry, earnings, and analyst target price.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
    },
    handler: async (params) => {
      try {
        const overview = await getOverview(apiKey, params.symbol as string);
        return successResult(JSON.stringify(overview, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  return {
    name: "alpha-vantage",
    description: "Alpha Vantage stock data -- quotes, daily prices, and company fundamentals",
    requiredEnvVars: ["ALPHA_VANTAGE_API_KEY"],
    tools: [quoteTool, dailyTool, overviewTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/alpha-vantage/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/alpha-vantage/client.ts src/modules/alpha-vantage/index.ts src/modules/alpha-vantage/__tests__/client.test.ts
git commit -m "feat: add Alpha Vantage module with quote, daily prices, and company overview tools"
```
