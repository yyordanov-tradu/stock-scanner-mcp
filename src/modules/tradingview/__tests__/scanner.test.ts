import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanStocks } from "../scanner.js";
import { STOCK_COLUMNS, STOCK_TIMEFRAMES } from "../columns.js";

describe("STOCK_COLUMNS", () => {
  it("has 81 column IDs", () => {
    expect(STOCK_COLUMNS).toHaveLength(81);
  });

  it("includes key indicators", () => {
    expect(STOCK_COLUMNS).toContain("close");
    expect(STOCK_COLUMNS).toContain("RSI");
    expect(STOCK_COLUMNS).toContain("MACD.macd");
    expect(STOCK_COLUMNS).toContain("EMA200");
    expect(STOCK_COLUMNS).toContain("volume");
  });

  it("includes pre-market and post-market columns", () => {
    expect(STOCK_COLUMNS).toContain("premarket_close");
    expect(STOCK_COLUMNS).toContain("premarket_change");
    expect(STOCK_COLUMNS).toContain("premarket_change_abs");
    expect(STOCK_COLUMNS).toContain("premarket_volume");
    expect(STOCK_COLUMNS).toContain("postmarket_close");
    expect(STOCK_COLUMNS).toContain("postmarket_change");
    expect(STOCK_COLUMNS).toContain("postmarket_change_abs");
    expect(STOCK_COLUMNS).toContain("postmarket_volume");
  });
});

describe("STOCK_TIMEFRAMES", () => {
  it("maps daily to empty suffix", () => {
    expect(STOCK_TIMEFRAMES["1d"]).toBe("");
  });

  it("maps 1h to |60", () => {
    expect(STOCK_TIMEFRAMES["1h"]).toBe("|60");
  });
});

describe("scanStocks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to TradingView API and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "NASDAQ:AAPL", d: [150.5, 1.2, 1.8] },
        ],
      }),
    });

    const rows = await scanStocks({ tickers: ["NASDAQ:AAPL"], columns: ["close", "change", "volume"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/america/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("NASDAQ:AAPL");
    expect(rows[0].data.close).toBe(150.5);
  });

  it("applies exchange filter when no tickers specified", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ exchange: "NYSE", filters: [{ left: "close", operation: "greater", right: 100 }] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.markets).toEqual(["NYSE"]);
    expect(callBody.filter).toHaveLength(1);
    expect(callBody.filter[0].left).toBe("close");
  });

  it("respects limit parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ limit: 10 });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.range).toEqual([0, 10]);
  });

  it("uses custom sort when provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ columns: ["change", "close"], sort: { sortBy: "change", sortOrder: "asc" } });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.sort).toEqual({ sortBy: "change", sortOrder: "asc" });
  });

  it("applies timeframe suffix for non-daily timeframes", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ timeframe: "1h", columns: ["close", "RSI", "name"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("close|60");
    expect(callBody.columns).toContain("RSI|60");
    expect(callBody.columns).toContain("name"); // metadata columns should NOT get suffix
  });

  it("does not apply timeframe suffix to pre/post-market columns", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({
      timeframe: "1h",
      columns: ["close", "premarket_close", "premarket_change", "postmarket_close", "postmarket_volume"],
    });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("close|60");
    expect(callBody.columns).toContain("premarket_close");
    expect(callBody.columns).toContain("premarket_change");
    expect(callBody.columns).toContain("postmarket_close");
    expect(callBody.columns).toContain("postmarket_volume");
  });
});

describe("createTradingviewModule", () => {
  it("returns module with 6 tools and no required env vars", async () => {
    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    expect(mod.name).toBe("tradingview");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(8);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "tradingview_scan",
      "tradingview_quote",
      "tradingview_technicals",
      "tradingview_top_gainers",
      "tradingview_top_losers",
      "tradingview_top_volume",
      "tradingview_market_indices",
      "tradingview_volume_breakout",
    ]);
  });

  it("tool handlers return valid JSON strings, not [object Object]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "NASDAQ:AAPL", d: [150.5, 1.2, 50000] },
        ],
      }),
    }));

    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();

    for (const tool of mod.tools) {
      const result = await tool.handler({ tickers: ["NASDAQ:AAPL"], limit: 5 });
      const text = result.content[0].text;
      expect(text).not.toContain("[object Object]");
      // Must be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
    }

    vi.restoreAllMocks();
  });

  it("quote tool requests pre-market and post-market columns", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));

    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    const quoteTool = mod.tools.find(t => t.name === "tradingview_quote")!;

    await quoteTool.handler({ tickers: ["AAPL"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("premarket_close");
    expect(callBody.columns).toContain("premarket_change");
    expect(callBody.columns).toContain("premarket_volume");
    expect(callBody.columns).toContain("postmarket_close");
    expect(callBody.columns).toContain("postmarket_change");
    expect(callBody.columns).toContain("postmarket_volume");

    vi.restoreAllMocks();
  });

  it("market_indices tool requests VIX, SPX, NDQ, DJI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "TVC:VIX", d: [23.5, -5.2, -1.3, 27.0, 23.1, 25.8, "VIX", "VOLATILITY S&P 500"] },
          { s: "TVC:SPX", d: [5800, 0.5, 29, 5820, 5780, 5790, "SPX", "S&P 500"] },
          { s: "TVC:NDQ", d: [18500, 0.8, 148, 18600, 18400, 18450, "NDQ", "NASDAQ Composite"] },
          { s: "TVC:DJI", d: [42000, 0.3, 126, 42100, 41900, 41950, "DJI", "Dow Jones Industrial Average"] },
        ],
      }),
    }));

    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    const tool = mod.tools.find(t => t.name === "tradingview_market_indices")!;

    const result = await tool.handler({});

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.symbols.tickers).toEqual(["TVC:VIX", "TVC:SPX", "TVC:NDQ", "TVC:DJI"]);
    expect(callBody.columns).toContain("close");
    expect(callBody.columns).toContain("change");
    expect(callBody.columns).toContain("name");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(4);
    expect(parsed[0].symbol).toBe("TVC:VIX");
    expect(parsed[0].data.close).toBe(23.5);

    vi.restoreAllMocks();
  });

  it("resolves simple tickers to exchange-qualified tickers in quote tool", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));

    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    const quoteTool = mod.tools.find(t => t.name === "tradingview_quote")!;

    await quoteTool.handler({ tickers: ["AAPL", "NYSE:IBM"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.symbols.tickers).toContain("NASDAQ:AAPL");
    expect(callBody.symbols.tickers).toContain("NYSE:IBM");

    vi.restoreAllMocks();
  });
});
