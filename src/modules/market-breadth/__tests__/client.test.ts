import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMarketBreadth, aggregateMarketBreadth } from "../client.js";
import { scanStocks } from "../../tradingview/scanner.js";
import { createMarketBreadthModule } from "../index.js";

vi.mock("../../tradingview/scanner.js", () => ({
  scanStocks: vi.fn(),
}));

describe("market-breadth module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMarketBreadthModule", () => {
    it("returns correct module metadata and tools", () => {
      const mod = createMarketBreadthModule();
      expect(mod.name).toBe("market-breadth");
      expect(mod.tools).toHaveLength(1);
      expect(mod.tools[0].name).toBe("market_breadth");
    });
  });

  describe("aggregateMarketBreadth", () => {
    it("aggregates advance/decline metrics correctly", () => {
      const rows = [
        { symbol: "A", data: { close: 100, change: 1.5, SMA50: 90, SMA200: 80, price_52_week_high: 105, price_52_week_low: 95, type: "stock" } },
        { symbol: "B", data: { close: 100, change: -2.0, SMA50: 110, SMA200: 120, price_52_week_high: 115, price_52_week_low: 98, type: "stock" } },
        { symbol: "C", data: { close: 100, change: 0, SMA50: 100, SMA200: 100, price_52_week_high: 100, price_52_week_low: 100, type: "stock" } },
      ];

      const res = aggregateMarketBreadth(rows, {
        universe: "major_us",
        limit: 3000,
        newHighLowThresholdPct: 0.5,
      });

      expect(res.sampleSize).toBe(3);
      expect(res.advanceDecline.advancers).toBe(1);
      expect(res.advanceDecline.decliners).toBe(1);
      expect(res.advanceDecline.unchanged).toBe(1);
      expect(res.advanceDecline.ratio).toBe(1.0);
      expect(res.advanceDecline.advancePercent).toBe(33.33);
      expect(res.advanceDecline.declinePercent).toBe(33.33);

      expect(res.movingAverages.aboveSma50).toBe(1);
      expect(res.movingAverages.aboveSma50Percent).toBe(33.33);

      expect(res.movingAverages.aboveSma200).toBe(1);
      expect(res.movingAverages.aboveSma200Percent).toBe(33.33);

      expect(res.newHighsLows.newHighs).toBe(1);
      expect(res.newHighsLows.newLows).toBe(1);
      expect(res.newHighsLows.denominator).toBe(3);
    });
  });

  describe("getMarketBreadth", () => {
    it("performs scanStocks calls for major_us exchanges and merges results", async () => {
      (scanStocks as ReturnType<typeof vi.fn>).mockResolvedValue([
        { symbol: "NYSE:X", data: { close: 10, change: 0.1, SMA50: 9, SMA200: 8, price_52_week_high: 11, price_52_week_low: 9, type: "stock" } },
      ]);

      const result = await getMarketBreadth({ universe: "major_us", limit: 1000 });

      expect(scanStocks).toHaveBeenCalledTimes(3); // NYSE, NASDAQ, AMEX
      expect(scanStocks).toHaveBeenNthCalledWith(1, expect.objectContaining({
        exchange: "NYSE",
        limit: 1000,
        columns: expect.arrayContaining(["price_52_week_high", "price_52_week_low"]),
        filters: expect.arrayContaining([
          { left: "exchange", operation: "equal", right: "NYSE" }
        ])
      }));
      expect(scanStocks).toHaveBeenNthCalledWith(2, expect.objectContaining({
        exchange: "NASDAQ",
        limit: 1000,
        columns: expect.arrayContaining(["price_52_week_high", "price_52_week_low"]),
        filters: expect.arrayContaining([
          { left: "exchange", operation: "equal", right: "NASDAQ" }
        ])
      }));
      expect(scanStocks).toHaveBeenNthCalledWith(3, expect.objectContaining({
        exchange: "AMEX",
        limit: 1000,
        columns: expect.arrayContaining(["price_52_week_high", "price_52_week_low"]),
        filters: expect.arrayContaining([
          { left: "exchange", operation: "equal", right: "AMEX" }
        ])
      }));

      expect(result.universe).toBe("major_us");
      expect(result.exchanges).toEqual(["NYSE", "NASDAQ", "AMEX"]);
      expect(result.sampleSize).toBe(3);
    });

    it("performs single call for individual exchange", async () => {
      (scanStocks as ReturnType<typeof vi.fn>).mockResolvedValue([
        { symbol: "NASDAQ:AAPL", data: { close: 150, change: 2.0, SMA50: 140, SMA200: 130, price_52_week_high: 160, price_52_week_low: 120, type: "stock" } },
      ]);

      const result = await getMarketBreadth({ universe: "NASDAQ", limit: 500 });

      expect(scanStocks).toHaveBeenCalledTimes(1);
      expect(scanStocks).toHaveBeenCalledWith(expect.objectContaining({
        exchange: "NASDAQ",
        limit: 500,
        columns: expect.arrayContaining(["price_52_week_high", "price_52_week_low"]),
        filters: expect.arrayContaining([
          { left: "exchange", operation: "equal", right: "NASDAQ" }
        ])
      }));
      expect(result.universe).toBe("NASDAQ");
      expect(result.exchanges).toEqual(["NASDAQ"]);
    });

    it("throws error if no rows returned from any scan", async () => {
      (scanStocks as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(getMarketBreadth({ universe: "NYSE" })).rejects.toThrow("Failed to fetch breadth data for universe: NYSE");
    });
  });
});
