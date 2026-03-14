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

describe("createFinnhubModule", () => {
  it("returns module with 5 tools and requires FINNHUB_API_KEY", async () => {
    const { createFinnhubModule } = await import("../index.js");
    const mod = createFinnhubModule("test-key");
    expect(mod.name).toBe("finnhub");
    expect(mod.requiredEnvVars).toEqual(["FINNHUB_API_KEY"]);
    expect(mod.tools).toHaveLength(5);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "finnhub_market_news",
      "finnhub_company_news",
      "finnhub_earnings_calendar",
      "finnhub_analyst_ratings",
      "finnhub_short_interest",
    ]);
  });
});
