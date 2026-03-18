import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEconomicCalendar,
  getIndicator,
  getIndicatorHistory,
  searchSeries,
  HIGH_IMPACT_RELEASES,
  COMMON_SERIES,
} from "../client.js";

describe("getEconomicCalendar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches upcoming release dates and filters to high-impact", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        release_dates: [
          { release_id: 10, release_name: "Consumer Price Index", date: "2026-04-10" },
          { release_id: 46, release_name: "Producer Price Index", date: "2026-04-11" },
          { release_id: 999, release_name: "Some Obscure Release", date: "2026-04-12" },
          { release_id: 50, release_name: "Employment Situation", date: "2026-04-15" },
        ],
      }),
    });

    const result = await getEconomicCalendar("test-key");

    // Should filter out release_id 999 (not in curated list)
    expect(result).toHaveLength(3);
    expect(result[0].release_name).toBe("Consumer Price Index");
    expect(result[1].release_name).toBe("Producer Price Index");
    expect(result[2].release_name).toBe("Employment Situation");
  });

  it("passes API key as query parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ release_dates: [] }),
    });

    await getEconomicCalendar("my-fred-key", 30);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("api_key=my-fred-key");
    expect(calledUrl).toContain("include_release_dates_with_no_data=true");
    expect(calledUrl).toContain("file_type=json");
  });

  it("returns empty array when no upcoming releases", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ release_dates: [] }),
    });

    const result = await getEconomicCalendar("test-key", 20);
    expect(result).toEqual([]);
  });
});

describe("getIndicator", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches latest value for a series ID", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [{
            id: "CPIAUCSL",
            title: "Consumer Price Index for All Urban Consumers",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            seasonal_adjustment: "Seasonally Adjusted",
            last_updated: "2026-03-12 07:36:03-05",
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: "2026-02-01", value: "320.125" },
          ],
        }),
      });

    const result = await getIndicator("test-key", "CPIAUCSL");

    expect(result.series.id).toBe("CPIAUCSL");
    expect(result.series.title).toContain("Consumer Price Index");
    expect(result.latest.value).toBe("320.125");
    expect(result.latest.date).toBe("2026-02-01");
  });

  it("resolves common aliases to series IDs", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seriess: [{ id: "GDPC1", title: "Real GDP", frequency: "Quarterly", units: "Billions", seasonal_adjustment: "SA", last_updated: "" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [{ date: "2026-01-01", value: "22000.0" }] }),
      });

    await getIndicator("test-key", "gdp");

    const firstUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstUrl).toContain("series_id=GDPC1");
  });

  it("handles missing value (FRED dot notation)", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seriess: [{ id: "DGS10", title: "10Y", frequency: "Daily", units: "%", seasonal_adjustment: "NSA", last_updated: "" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [{ date: "2026-03-17", value: "." }] }),
      });

    const result = await getIndicator("test-key", "DGS10");
    expect(result.latest.value).toBeNull();
  });
});

describe("getIndicatorHistory", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches observations for a date range", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-01-01", value: "318.5" },
          { date: "2026-02-01", value: "320.1" },
          { date: "2026-03-01", value: "321.8" },
        ],
      }),
    });

    const result = await getIndicatorHistory(
      "test-key", "CPIAUCSL", "2026-01-01", "2026-03-31",
    );

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2026-01-01");
    expect(result[2].value).toBe("321.8");
  });

  it("supports units parameter for percent change", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-01-01", value: "3.2" },
        ],
      }),
    });

    await getIndicatorHistory("test-key", "CPIAUCSL", "2026-01-01", "2026-03-31", "pc1");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("units=pc1");
  });

  it("filters out missing values (dot notation)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-03-14", value: "4.25" },
          { date: "2026-03-15", value: "." },
          { date: "2026-03-16", value: "4.30" },
        ],
      }),
    });

    const result = await getIndicatorHistory(
      "test-key", "DGS10", "2026-03-14", "2026-03-16",
    );

    // Missing values filtered out
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.value !== null)).toBe(true);
  });

  it("resolves aliases to series IDs", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [] }),
    });

    await getIndicatorHistory("test-key", "gdp", "2025-01-01", "2025-12-31");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("series_id=GDPC1");
  });
});

describe("searchSeries", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches FRED series by keyword", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        seriess: [
          {
            id: "CPIAUCSL",
            title: "Consumer Price Index for All Urban Consumers",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            popularity: 95,
            last_updated: "2026-03-12",
          },
          {
            id: "CPILFESL",
            title: "CPI Less Food and Energy",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            popularity: 80,
            last_updated: "2026-03-12",
          },
        ],
      }),
    });

    const results = await searchSeries("test-key", "consumer price index", 10);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("CPIAUCSL");
    expect(results[0].popularity).toBe(95);
  });

  it("encodes search text in URL", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ seriess: [] }),
    });

    await searchSeries("test-key", "consumer price index", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("search_text=consumer%20price%20index");
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("order_by=search_rank");
  });
});

describe("createFredModule", () => {
  it("returns module with 4 tools and requires FRED_API_KEY", async () => {
    const { createFredModule } = await import("../index.js");
    const mod = createFredModule("test-key");
    expect(mod.name).toBe("fred");
    expect(mod.requiredEnvVars).toEqual(["FRED_API_KEY"]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "fred_economic_calendar",
      "fred_indicator",
      "fred_indicator_history",
      "fred_search",
    ]);
  });
});
