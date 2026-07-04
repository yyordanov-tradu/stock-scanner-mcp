import { describe, it, expect, vi, beforeEach } from "vitest";
import { routeGetQuote, routeGetProfile } from "../client.js";
import { Config } from "../../../config.js";
import * as finnhubClient from "../../finnhub/client.js";
import * as avClient from "../../alpha-vantage/client.js";
import * as tvScanner from "../../tradingview/scanner.js";

// Mock the dependencies
vi.mock("../../finnhub/client.js");
vi.mock("../../alpha-vantage/client.js");
vi.mock("../../tradingview/scanner.js");
vi.mock("../../tradingview-crypto/scanner.js", () => ({
  scanCrypto: vi.fn(),
}));

describe("Unified Market Client Router", () => {
  let config: Config;

  beforeEach(() => {
    vi.resetAllMocks();
    config = {
      env: {
        FINNHUB_API_KEY: "test_finnhub_key",
        ALPHA_VANTAGE_API_KEY: "test_av_key",
      },
      cli: {},
    } as any;
  });

  describe("routeGetQuote", () => {
    it("should route to Finnhub successfully", async () => {
      vi.mocked(finnhubClient.getQuote).mockResolvedValue({
        c: 150, d: 2, dp: 1.3, h: 155, l: 145, o: 148, pc: 148, t: 123456789
      });

      const result = await routeGetQuote("AAPL", config);

      expect(finnhubClient.getQuote).toHaveBeenCalledWith("test_finnhub_key", "AAPL");
      expect(result.resolvedProvider).toBe("finnhub");
      expect(result.price).toBe(150);
      expect(result.change).toBe(2);
      expect(avClient.getQuote).not.toHaveBeenCalled();
      expect(tvScanner.scanStocks).not.toHaveBeenCalled();
    });

    it("should fall back to TradingView if Finnhub and AV hit rate limits", async () => {
      // Finnhub hits 429
      vi.mocked(finnhubClient.getQuote).mockRejectedValue(new Error("HTTP 429 Too Many Requests"));
      
      // AV hits 200 with Rate Limit Note
      vi.mocked(avClient.getQuote).mockRejectedValue(new Error("Alpha Vantage Rate Limit: Thank you for using..."));

      // TV succeeds
      vi.mocked(tvScanner.scanStocks).mockResolvedValue([{
        symbol: "NASDAQ:AAPL",
        data: { close: 145, change_abs: -5, change: -3.3, volume: 1000000, high: 150, low: 140, open: 150 }
      }]);

      const result = await routeGetQuote("AAPL", config);

      expect(finnhubClient.getQuote).toHaveBeenCalled();
      expect(avClient.getQuote).toHaveBeenCalled();
      expect(tvScanner.scanStocks).toHaveBeenCalled();
      expect(result.resolvedProvider).toBe("tradingview");
      expect(result.price).toBe(145);
      expect(result.dataDelay).toBe("15min");
    });

    it("should throw NOT_FOUND and not fallback if Finnhub returns all-zero sentinel", async () => {
      // Sentinel for invalid ticker
      vi.mocked(finnhubClient.getQuote).mockResolvedValue({
        c: 0, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0, t: 0
      });

      await expect(routeGetQuote("INVALIDTICKER", config)).rejects.toThrow("Finnhub returned empty quote");
      
      expect(avClient.getQuote).not.toHaveBeenCalled();
      expect(tvScanner.scanStocks).not.toHaveBeenCalled();
    });

    it("should throw NOT_FOUND and not fallback if Finnhub throws 404", async () => {
      vi.mocked(finnhubClient.getQuote).mockRejectedValue(new Error("HTTP 404 not found"));

      await expect(routeGetQuote("INVALIDTICKER", config)).rejects.toThrow("HTTP 404 not found");
      
      expect(avClient.getQuote).not.toHaveBeenCalled();
      expect(tvScanner.scanStocks).not.toHaveBeenCalled();
    });
  });

  describe("routeGetProfile", () => {
    it("should throw NOT_FOUND and not fallback if Finnhub returns empty profile", async () => {
      // Empty profile
      vi.mocked(finnhubClient.getCompanyProfile).mockResolvedValue({} as any);

      await expect(routeGetProfile("INVALIDTICKER", config)).rejects.toThrow("Finnhub returned empty profile");
      
      expect(avClient.getOverview).not.toHaveBeenCalled();
      expect(tvScanner.scanStocks).not.toHaveBeenCalled();
    });
  });
});
