# Task 12: Finnhub Module

**Files:**
- Create: `src/modules/finnhub/client.ts`
- Create: `src/modules/finnhub/index.ts`
- Test: `src/modules/finnhub/__tests__/client.test.ts`

---

**Step 1: Write the test**

Create `src/modules/finnhub/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMarketNews, getCompanyNews } from "../client.js";

describe("getMarketNews", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches news with API key header", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          category: "technology",
          datetime: 1710500000,
          headline: "Tech stocks rally",
          id: 12345,
          source: "Reuters",
          summary: "Technology stocks saw gains today.",
          url: "https://example.com/news/1",
          related: "AAPL,MSFT",
        },
      ],
    });

    const news = await getMarketNews("test-api-key", "general");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("finnhub.io/api/v1/news"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Finnhub-Token": "test-api-key",
        }),
      }),
    );
    expect(news).toHaveLength(1);
    expect(news[0].headline).toBe("Tech stocks rally");
    expect(news[0].source).toBe("Reuters");
  });

  it("limits results to 20", async () => {
    const manyArticles = Array.from({ length: 30 }, (_, i) => ({
      category: "general",
      datetime: 1710500000 + i,
      headline: `Article ${i}`,
      id: i,
      source: "Test",
      summary: "Summary",
      url: `https://example.com/${i}`,
      related: "",
    }));

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => manyArticles,
    });

    const news = await getMarketNews("key");
    expect(news).toHaveLength(20);
  });
});

describe("getCompanyNews", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches company news with symbol and date range", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          category: "company",
          datetime: 1710500000,
          headline: "Apple Q1 results",
          source: "Bloomberg",
          summary: "Apple reported strong earnings.",
          url: "https://example.com/apple-q1",
        },
      ],
    });

    const news = await getCompanyNews("key", "AAPL", "2024-01-01", "2024-03-15");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("symbol=AAPL");
    expect(calledUrl).toContain("from=2024-01-01");
    expect(calledUrl).toContain("to=2024-03-15");
    expect(news).toHaveLength(1);
    expect(news[0].headline).toBe("Apple Q1 results");
  });
});

describe("createFinnhubModule", () => {
  it("returns module with 3 tools and requires FINNHUB_API_KEY", async () => {
    const { createFinnhubModule } = await import("../index.js");
    const mod = createFinnhubModule("test-key");
    expect(mod.name).toBe("finnhub");
    expect(mod.requiredEnvVars).toEqual(["FINNHUB_API_KEY"]);
    expect(mod.tools).toHaveLength(3);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "finnhub_market_news", "finnhub_company_news", "finnhub_earnings_calendar"
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/finnhub/__tests__/client.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the code**

Create `src/modules/finnhub/client.ts`:

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://finnhub.io/api/v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface NewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  source: string;
  summary: string;
  url: string;
  related: string;
}

export async function getMarketNews(apiKey: string, category: string = "general"): Promise<NewsArticle[]> {
  const cacheKey = `news:${category}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as NewsArticle[];

  const articles = await httpGet<Array<{
    category: string;
    datetime: number;
    headline: string;
    id: number;
    source: string;
    summary: string;
    url: string;
    related: string;
  }>>(`${BASE_URL}/news?category=${encodeURIComponent(category)}`, {
    headers: { "X-Finnhub-Token": apiKey },
  });

  const result: NewsArticle[] = articles.slice(0, 20).map((a) => ({
    category: a.category,
    datetime: a.datetime,
    headline: a.headline,
    id: a.id,
    source: a.source,
    summary: a.summary.slice(0, 300),
    url: a.url,
    related: a.related,
  }));

  cache.set(cacheKey, result);
  return result;
}

export interface CompanyNews {
  category: string;
  datetime: number;
  headline: string;
  source: string;
  summary: string;
  url: string;
}

export async function getCompanyNews(
  apiKey: string,
  symbol: string,
  from: string,
  to: string,
): Promise<CompanyNews[]> {
  const cacheKey = `company-news:${symbol}:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyNews[];

  const articles = await httpGet<Array<{
    category: string;
    datetime: number;
    headline: string;
    source: string;
    summary: string;
    url: string;
  }>>(`${BASE_URL}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`, {
    headers: { "X-Finnhub-Token": apiKey },
  });

  const result: CompanyNews[] = articles.slice(0, 20).map((a) => ({
    category: a.category,
    datetime: a.datetime,
    headline: a.headline,
    source: a.source,
    summary: a.summary.slice(0, 300),
    url: a.url,
  }));

  cache.set(cacheKey, result);
  return result;
}

export interface EarningsEvent {
  date: string;
  symbol: string;
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  year: number;
}

export async function getEarningsCalendar(apiKey: string, from: string, to: string): Promise<EarningsEvent[]> {
  const cacheKey = `earnings:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as EarningsEvent[];

  const data = await httpGet<{ earningsCalendar: EarningsEvent[] }>(
    `${BASE_URL}/calendar/earnings?from=${from}&to=${to}`,
    { headers: { "X-Finnhub-Token": apiKey } }
  );

  const result = data.earningsCalendar;
  cache.set(cacheKey, result);
  return result;
}
```

Create `src/modules/finnhub/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { getMarketNews, getCompanyNews, getEarningsCalendar } from "./client.js";

export function createFinnhubModule(apiKey: string): ModuleDefinition {
  const marketNewsTool: ToolDefinition = {
    name: "finnhub_market_news",
    description: "Get latest market news from Finnhub. Returns top 20 articles with headlines, summaries, and URLs.",
    inputSchema: {
      category: z.string().optional().describe("News category: 'general', 'forex', 'crypto', 'merger'. Default: 'general'"),
    },
    handler: async (params) => {
      try {
        const news = await getMarketNews(apiKey, params.category as string | undefined);
        return successResult(JSON.stringify(news, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const companyNewsTool: ToolDefinition = {
    name: "finnhub_company_news",
    description: "Get news for a specific company from Finnhub. Requires date range.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      from: z.string().describe("Start date in YYYY-MM-DD format"),
      to: z.string().describe("End date in YYYY-MM-DD format"),
    },
    handler: async (params) => {
      try {
        const news = await getCompanyNews(
          apiKey,
          params.symbol as string,
          params.from as string,
          params.to as string,
        );
        return successResult(JSON.stringify(news, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const earningsCalendarTool: ToolDefinition = {
    name: "finnhub_earnings_calendar",
    description: "Get upcoming or historical earnings announcements for a date range.",
    inputSchema: {
      from: z.string().describe("Start date (YYYY-MM-DD)"),
      to: z.string().describe("End date (YYYY-MM-DD)"),
    },
    handler: async (params) => {
      try {
        const events = await getEarningsCalendar(apiKey, params.from as string, params.to as string);
        return successResult(JSON.stringify(events, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  return {
    name: "finnhub",
    description: "Finnhub market and company news, plus earnings calendar",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    tools: [marketNewsTool, companyNewsTool, earningsCalendarTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/finnhub/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/finnhub/client.ts src/modules/finnhub/index.ts src/modules/finnhub/__tests__/client.test.ts
git commit -m "feat: add Finnhub module with market news and company news tools"
```
