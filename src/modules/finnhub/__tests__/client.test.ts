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

    const news = await getMarketNews("key", "forex");
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

describe("getEarningsCalendar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches earnings calendar with date range", async () => {
    const mockEvents = [
      {
        date: "2026-03-20",
        symbol: "AAPL",
        actual: 1.52,
        estimate: 1.50,
        period: "2025-12-31",
        quarter: 1,
        year: 2026,
      },
    ];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ earningsCalendar: mockEvents }),
    });

    const { getEarningsCalendar } = await import("../client.js");
    const result = await getEarningsCalendar("test-key", "2026-03-15", "2026-03-22");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/calendar/earnings?from=2026-03-15&to=2026-03-22");
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("AAPL");
    expect(result[0].actual).toBe(1.52);
  });

  it("includes symbol filter when provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ earningsCalendar: [] }),
    });

    const { getEarningsCalendar } = await import("../client.js");
    await getEarningsCalendar("test-key", "2026-03-15", "2026-03-22", "AAPL");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("symbol=AAPL");
  });
});

describe("getShortInterest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches short interest metrics with API key header", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "AAPL",
        metric: {
          "52WeekHigh": 199.62,
          "52WeekLow": 143.90,
          shortInterest: 120000000,
          shortRatio: 1.5,
          shortPercentOfFloat: 0.75,
        },
      }),
    });

    const { getShortInterest } = await import("../client.js");
    const result = await getShortInterest("test-key", "AAPL");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("stock/metric?symbol=AAPL"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Finnhub-Token": "test-key",
        }),
      }),
    );
    expect(result.symbol).toBe("AAPL");
    expect(result.metric.shortInterest).toBe(120000000);
    expect(result.metric.shortRatio).toBe(1.5);
    expect(result.metric["52WeekHigh"]).toBe(199.62);
  });
});

describe("createFinnhubModule", () => {
  it("returns module with 9 tools and requires FINNHUB_API_KEY", async () => {
    const { createFinnhubModule } = await import("../index.js");
    const mod = createFinnhubModule("test-key");
    expect(mod.name).toBe("finnhub");
    expect(mod.requiredEnvVars).toEqual(["FINNHUB_API_KEY"]);
    expect(mod.tools).toHaveLength(9);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "finnhub_quote",
      "finnhub_company_profile",
      "finnhub_peers",
      "finnhub_market_status",
      "finnhub_market_news",
      "finnhub_company_news",
      "finnhub_earnings_calendar",
      "finnhub_analyst_ratings",
      "finnhub_short_interest",
    ]);
  });
});
