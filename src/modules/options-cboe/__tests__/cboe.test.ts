import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Sample CBOE daily JSON matching the real endpoint structure. */
function makeDailyJson(opts: {
  totalRatio: string;
  equityRatio: string;
  indexRatio: string;
  totalCall: number;
  totalPut: number;
  equityCall: number;
  equityPut: number;
  indexCall: number;
  indexPut: number;
}) {
  return {
    ratios: [
      { name: "TOTAL PUT/CALL RATIO", value: opts.totalRatio },
      { name: "INDEX PUT/CALL RATIO", value: opts.indexRatio },
      { name: "EQUITY PUT/CALL RATIO", value: opts.equityRatio },
    ],
    "SUM OF ALL PRODUCTS": [{ name: "VOLUME", call: opts.totalCall, put: opts.totalPut, total: opts.totalCall + opts.totalPut }],
    "EQUITY OPTIONS": [{ name: "VOLUME", call: opts.equityCall, put: opts.equityPut, total: opts.equityCall + opts.equityPut }],
    "INDEX OPTIONS": [{ name: "VOLUME", call: opts.indexCall, put: opts.indexPut, total: opts.indexCall + opts.indexPut }],
  };
}

const SAMPLE_DAY_1 = makeDailyJson({
  totalRatio: "1.00", equityRatio: "0.86", indexRatio: "0.99",
  totalCall: 5893945, totalPut: 5921060,
  equityCall: 1709747, equityPut: 1466886,
  indexCall: 3270167, indexPut: 3244791,
});

const SAMPLE_DAY_2 = makeDailyJson({
  totalRatio: "1.15", equityRatio: "0.72", indexRatio: "1.30",
  totalCall: 5000000, totalPut: 5750000,
  equityCall: 1500000, equityPut: 1080000,
  indexCall: 3000000, indexPut: 3900000,
});

const SAMPLE_DAY_3 = makeDailyJson({
  totalRatio: "0.90", equityRatio: "0.65", indexRatio: "1.10",
  totalCall: 6000000, totalPut: 5400000,
  equityCall: 1800000, equityPut: 1170000,
  indexCall: 3500000, indexPut: 3850000,
});

/**
 * Build a fetch mock that returns CBOE JSON for known dates and 403 for others.
 * dateMap: { "2026-03-17": jsonObj, ... }
 */
function mockCboeFetch(dateMap: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const match = url.match(/(\d{4}-\d{2}-\d{2})_daily_options$/);
    if (match && dateMap[match[1]]) {
      return { ok: true, json: async () => dateMap[match[1]], text: async () => JSON.stringify(dateMap[match[1]]) };
    }
    return { ok: false, status: 403, statusText: "Forbidden", text: async () => "Access Denied" };
  });
}

describe("getPutCallRatio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fetches total put/call ratio from CBOE JSON endpoint", async () => {
    // Set time to Wednesday 2026-03-18 12:00 UTC — will look back from 2026-03-17
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    vi.stubGlobal("fetch", mockCboeFetch({
      "2026-03-17": SAMPLE_DAY_1,
      "2026-03-16": SAMPLE_DAY_2,
      "2026-03-13": SAMPLE_DAY_3,
    }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      date: "2026-03-17",
      callVolume: 5893945,
      putVolume: 5921060,
      totalVolume: 11815005,
      putCallRatio: 1.00,
    });
    expect(result[1]).toEqual({
      date: "2026-03-16",
      callVolume: 5000000,
      putVolume: 5750000,
      totalVolume: 10750000,
      putCallRatio: 1.15,
    });
  });

  it("fetches equity type with correct ratio and volume section", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    vi.stubGlobal("fetch", mockCboeFetch({ "2026-03-17": SAMPLE_DAY_1 }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("equity", 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: "2026-03-17",
      callVolume: 1709747,
      putVolume: 1466886,
      totalVolume: 3176633,
      putCallRatio: 0.86,
    });
  });

  it("fetches index type with correct ratio and volume section", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    vi.stubGlobal("fetch", mockCboeFetch({ "2026-03-17": SAMPLE_DAY_1 }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("index", 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: "2026-03-17",
      callVolume: 3270167,
      putVolume: 3244791,
      totalVolume: 6514958,
      putCallRatio: 0.99,
    });
  });

  it("skips weekends when walking backwards", async () => {
    // Monday 2026-03-16 — look back: Sun 15 (skip), Sat 14 (skip), Fri 13
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
    vi.stubGlobal("fetch", mockCboeFetch({
      "2026-03-13": SAMPLE_DAY_1,
      "2026-03-12": SAMPLE_DAY_2,
    }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 2);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-03-13");
    expect(result[1].date).toBe("2026-03-12");
  });

  it("skips holidays (403 responses) gracefully", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    // 2026-03-17 returns 403 (holiday), 2026-03-16 has data
    vi.stubGlobal("fetch", mockCboeFetch({
      "2026-03-16": SAMPLE_DAY_1,
    }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 1);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-16");
  });

  it("returns only the requested number of days", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    vi.stubGlobal("fetch", mockCboeFetch({
      "2026-03-17": SAMPLE_DAY_1,
      "2026-03-16": SAMPLE_DAY_2,
      "2026-03-13": SAMPLE_DAY_3,
    }));

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 2);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-03-17");
    expect(result[1].date).toBe("2026-03-16");
  });

  it("throws on unknown put/call ratio type", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));

    const { getPutCallRatio } = await import("../cboe.js");
    await expect(getPutCallRatio("unknown", 5)).rejects.toThrow(
      "Unknown put/call ratio type: unknown",
    );
  });

  it("uses CBOE CDN URL with correct date format", async () => {
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
    const fetchMock = mockCboeFetch({ "2026-03-17": SAMPLE_DAY_1 });
    vi.stubGlobal("fetch", fetchMock);

    const { getPutCallRatio } = await import("../cboe.js");
    await getPutCallRatio("total", 1);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("cdn.cboe.com/data/us/options/market_statistics/daily/2026-03-17_daily_options"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("createOptionsCboeModule", () => {
  it("returns module with 1 tool, no required env vars, tool name is options_put_call_ratio", async () => {
    const { createOptionsCboeModule } = await import("../index.js");
    const mod = createOptionsCboeModule();

    expect(mod.name).toBe("options-cboe");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(1);
    expect(mod.tools[0].name).toBe("options_put_call_ratio");
  });
});
