import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanStocks } from "../scanner.js";
import { STOCK_COLUMNS, STOCK_TIMEFRAMES } from "../columns.js";

describe("STOCK_COLUMNS", () => {
  it("has 73 column IDs", () => {
    expect(STOCK_COLUMNS).toHaveLength(73);
  });

  it("includes key indicators", () => {
    expect(STOCK_COLUMNS).toContain("close");
    expect(STOCK_COLUMNS).toContain("RSI");
    expect(STOCK_COLUMNS).toContain("MACD.macd");
    expect(STOCK_COLUMNS).toContain("EMA200");
    expect(STOCK_COLUMNS).toContain("volume");
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
});

describe("createTradingviewModule", () => {
  it("returns module with 6 tools and no required env vars", async () => {
    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    expect(mod.name).toBe("tradingview");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(6);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "tradingview_scan",
      "tradingview_quote",
      "tradingview_technicals",
      "tradingview_top_gainers",
      "tradingview_top_volume",
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
