import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SAMPLE_CSV = `DATE,CALL,PUT,TOTAL,P/C RATIO
03/14/2026,1500000,1200000,2700000,0.80
03/13/2026,1400000,1300000,2700000,0.93
03/12/2026,1600000,1100000,2700000,0.69
03/11/2026,1350000,1450000,2800000,1.07
03/10/2026,1500000,1500000,3000000,1.00`;

describe("getPutCallRatio", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches total put/call ratio CSV and parses it correctly", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CSV,
    });

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 30);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("cdn.cboe.com"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("totalpc.csv");

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      date: "2026-03-14",
      callVolume: 1500000,
      putVolume: 1200000,
      totalVolume: 2700000,
      putCallRatio: 0.80,
    });
  });

  it("selects correct CSV URL for equity type", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CSV,
    });

    const { getPutCallRatio } = await import("../cboe.js");
    await getPutCallRatio("equity", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("equitypc.csv");
  });

  it("selects correct CSV URL for index type", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CSV,
    });

    const { getPutCallRatio } = await import("../cboe.js");
    await getPutCallRatio("index", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("indexpcarchive.csv");
  });

  it("returns only the requested number of recent days", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_CSV,
    });

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 3);

    expect(result).toHaveLength(3);
    // Most recent first (sorted once during fetch)
    expect(result[0].date).toBe("2026-03-14");
    expect(result[1].date).toBe("2026-03-13");
    expect(result[2].date).toBe("2026-03-12");
  });

  it("handles empty and malformed lines gracefully", async () => {
    const csvWithBadLines = `DATE,CALL,PUT,TOTAL,P/C RATIO
03/14/2026,1500000,1200000,2700000,0.80

bad,data
03/12/2026,abc,def,ghi,jkl
short,row
03/10/2026,1500000,1500000,3000000,1.00`;

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => csvWithBadLines,
    });

    const { getPutCallRatio } = await import("../cboe.js");
    const result = await getPutCallRatio("total", 30);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-03-14");
    expect(result[1].date).toBe("2026-03-10");
  });

  it("throws on unknown put/call ratio type", async () => {
    const { getPutCallRatio } = await import("../cboe.js");
    await expect(getPutCallRatio("unknown", 5)).rejects.toThrow(
      "Unknown put/call ratio type: unknown",
    );
  });

  it("propagates HTTP errors from httpGet", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "server down",
    });

    const { getPutCallRatio } = await import("../cboe.js");
    await expect(getPutCallRatio("total", 5)).rejects.toThrow("HTTP 503");
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
