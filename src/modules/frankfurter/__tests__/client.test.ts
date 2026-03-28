import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLatestRates,
  getHistoricalRates,
  getTimeSeries,
  convertCurrency,
  getCurrencies,
} from "../client.js";

function mockFetchJson(data: unknown) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

describe("getLatestRates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches latest rates for a base currency", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      date: "2026-03-27",
      rates: { USD: 1.0832, GBP: 0.8621 },
    });

    const result = await getLatestRates("EUR");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.frankfurter.dev/v1/latest"),
      expect.anything(),
    );
    expect(result.base).toBe("EUR");
    expect(result.rates.USD).toBe(1.0832);
    expect(result.rates.GBP).toBe(0.8621);
  });

  it("passes symbols filter as query parameter", async () => {
    mockFetchJson({
      amount: 1,
      base: "USD",
      date: "2026-03-27",
      rates: { EUR: 0.9225 },
    });

    const result = await getLatestRates("USD", "EUR");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("symbols=EUR");
    expect(calledUrl).toContain("base=USD");
    expect(result.rates.EUR).toBe(0.9225);
  });

  it("returns cached result on second call", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      date: "2026-03-27",
      rates: { USD: 1.0832 },
    });

    const first = await getLatestRates("EUR", "USD");
    const second = await getLatestRates("EUR", "USD");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe("getHistoricalRates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches rates for a specific date", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      date: "2026-01-15",
      rates: { USD: 1.0901, JPY: 161.32 },
    });

    const result = await getHistoricalRates("EUR", "2026-01-15");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("2026-01-15");
    expect(result.date).toBe("2026-01-15");
    expect(result.rates.USD).toBe(1.0901);
  });

  it("handles weekend fallback where response date differs from request", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      date: "2026-01-16",
      rates: { USD: 1.0901 },
    });

    // Request Saturday, API returns Friday
    const result = await getHistoricalRates("EUR", "2026-01-17", "USD");

    expect(result.date).toBe("2026-01-16");
    expect(result.rates.USD).toBe(1.0901);
  });
});

describe("getTimeSeries", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches time series for a date range", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      rates: {
        "2026-01-02": { USD: 1.0350 },
        "2026-01-03": { USD: 1.0380 },
        "2026-01-06": { USD: 1.0410 },
      },
    });

    const result = await getTimeSeries("EUR", "USD", "2026-01-01", "2026-01-31");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("2026-01-01..2026-01-31");
    expect(calledUrl).toContain("symbols=USD");
    expect(result.start_date).toBe("2026-01-01");
    expect(result.end_date).toBe("2026-01-31");
    expect(Object.keys(result.rates)).toHaveLength(3);
  });

  it("caps end date at min(start+90, today) when requested end is too far", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      start_date: "2025-01-01",
      end_date: "2025-04-01",
      rates: {},
    });

    // Request a year-long range starting in the past — should cap at start+90
    await getTimeSeries("EUR", "USD", "2025-01-01", "2025-12-31");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // 90 days from 2025-01-01 = 2025-04-01 (which is before today, so start+90 wins)
    expect(calledUrl).toContain("2025-01-01..2025-04-01");
    expect(calledUrl).not.toContain("2025-12-31");
  });

  it("defaults end date to today when start is recent and start+90 is in the future", async () => {
    mockFetchJson({
      amount: 1,
      base: "GBP",
      start_date: "2026-03-01",
      end_date: "2026-03-28",
      rates: {},
    });

    // No end date, start is recent — capEndDate should return today (not start+90 which is in the future)
    await getTimeSeries("GBP", "JPY", "2026-03-01");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // Should cap at today, not at 2026-05-30 (start+90)
    expect(calledUrl).toContain("2026-03-01..");
    expect(calledUrl).not.toContain("2026-05");
  });
});

describe("convertCurrency", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts an amount from one currency to another", async () => {
    mockFetchJson({
      amount: 100,
      base: "USD",
      date: "2026-03-27",
      rates: { EUR: 92.25 },
    });

    const result = await convertCurrency(100, "USD", "EUR");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("amount=100");
    expect(calledUrl).toContain("base=USD");
    expect(calledUrl).toContain("symbols=EUR");
    expect(result.amount).toBe(100);
    expect(result.rates.EUR).toBe(92.25);
  });
});

describe("getCurrencies", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a map of currency codes to names", async () => {
    mockFetchJson({
      EUR: "Euro",
      USD: "United States Dollar",
      GBP: "British Pound",
      JPY: "Japanese Yen",
    });

    const result = await getCurrencies();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.frankfurter.dev/v1/currencies"),
      expect.anything(),
    );
    expect(result.EUR).toBe("Euro");
    expect(result.USD).toBe("United States Dollar");
    expect(Object.keys(result)).toHaveLength(4);
  });

});

describe("error handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("propagates HTTP errors from upstream", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => '{"message":"not found"}',
    });
    await expect(getLatestRates("INVALID")).rejects.toThrow();
  });
});
