import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyPrices, getQuote, getOverview } from "../client.js";

describe("Alpha Vantage error handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws descriptive error on rate limit Note", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "Note": "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day."
      }),
    });

    await expect(getDailyPrices("key", "TSLA")).rejects.toThrow(/Alpha Vantage Rate Limit/);
  });

  it("throws descriptive error on Information message", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "Information": "The service is temporarily unavailable."
      }),
    });

    await expect(getQuote("key", "TSLA")).rejects.toThrow(/Alpha Vantage Info/);
  });

  it("throws descriptive error on Error Message", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "Error Message": "Invalid API call. Please retry."
      }),
    });

    await expect(getOverview("key", "INVALID")).rejects.toThrow(/Alpha Vantage Error/);
  });
});
