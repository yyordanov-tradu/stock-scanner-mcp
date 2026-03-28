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

  it("caps end date at 90 days from start", async () => {
    mockFetchJson({
      amount: 1,
      base: "EUR",
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      rates: {},
    });

    await getTimeSeries("EUR", "USD", "2026-01-01", "2026-12-31");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // 90 days from 2026-01-01 = 2026-04-01
    expect(calledUrl).toContain("2026-01-01..2026-04-01");
    expect(calledUrl).not.toContain("2026-12-31");
  });

  it("defaults end date to 90 days from start when not provided", async () => {
    mockFetchJson({
      amount: 1,
      base: "GBP",
      start_date: "2026-02-01",
      end_date: "2026-05-02",
      rates: {},
    });

    await getTimeSeries("GBP", "JPY", "2026-02-01");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("2026-02-01..2026-05-02");
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

  it("returns cached result on second call", async () => {
    // getCurrencies has no parameters, so it shares cache key with the test above.
    // The first test already populated the cache, so both calls here hit cache.
    // We verify fetch is NOT called at all (0 times) because data is already cached.
    const first = await getCurrencies();
    const second = await getCurrencies();

    expect(fetch).toHaveBeenCalledTimes(0);
    expect(second).toEqual(first);
  });
});
