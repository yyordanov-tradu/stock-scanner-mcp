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
  it("returns module with 5 tools and requires ALPHA_VANTAGE_API_KEY", async () => {
    const { createAlphaVantageModule } = await import("../index.js");
    const mod = createAlphaVantageModule("test-key");
    expect(mod.name).toBe("alpha-vantage");
    expect(mod.requiredEnvVars).toEqual(["ALPHA_VANTAGE_API_KEY"]);
    expect(mod.tools).toHaveLength(5);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "alphavantage_quote", "alphavantage_daily", "alphavantage_overview", "alphavantage_earnings_history", "alphavantage_dividend_history",
    ]);
  });
});
